import { db } from '../db/index.js';
import {
  trashItems,
  documents,
  documentVersions,
  forms,
  folders,
  tasks,
  formInstances,
  formSubmissions,
  temporaryUploads,
  securityEvents,
  leakScans,
  leakReports,
  honeytokenTriggers,
} from '../db/schema.js';
import { eq, desc, and, isNull } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';

function resolveOrgId(req) {
  return req.user?.organizationId || null;
}

// Several tables reference documents.id without an onDelete policy, so Postgres rejects a plain
// DELETE while child rows exist; clear or drop those references first (cascade/set-null tables are handled by the DB).
async function hardDeleteDocument(tx, docId) {
  // AI-derived content first, and it MUST be first.
  //
  // ai_project_sources.document_id is ON DELETE CASCADE, so the DELETE below makes the source
  // rows vanish — and eraseOutputsForDocument finds outputs by looking sources up from the
  // documentId. Run it afterwards and it matches nothing while the outputs keep the deleted
  // document's content in readable form.
  //
  // Chunks ride the same cascade (ai_source_chunks → source_id/document_id), but outputs have
  // NO foreign key to documents or sources — only a source_ids jsonb — so nothing about this
  // delete touches them. They are encrypted under the PROJECT key, which also survives. This
  // call is the only thing that erases them.
  try {
    const { eraseOutputsForDocument } = await import('../services/ai-project-output.service.js');
    await eraseOutputsForDocument(docId, 'Dokumen sumber dihapus permanen');
  } catch (err) {
    // Erasing too much is the safe direction; failing to erase is not. Surface it loudly but
    // do not block the delete the user asked for.
    console.error(`[trash] AI output erase failed for document ${docId}:`, err.message);
  }

  // These records keep meaning after the document is gone, so just null the link
  await tx.update(tasks).set({ relatedDocumentId: null }).where(eq(tasks.relatedDocumentId, docId));
  await tx.update(formInstances).set({ generatedDocumentId: null }).where(eq(formInstances.generatedDocumentId, docId));
  await tx.update(formSubmissions).set({ generatedDocumentId: null }).where(eq(formSubmissions.generatedDocumentId, docId));
  await tx.update(temporaryUploads).set({ resultDocumentId: null }).where(eq(temporaryUploads.resultDocumentId, docId));
  await tx.update(securityEvents).set({ relatedDocumentId: null }).where(eq(securityEvents.relatedDocumentId, docId));
  await tx.update(leakScans).set({ documentId: null }).where(eq(leakScans.documentId, docId));
  await tx.update(leakReports).set({ documentId: null }).where(eq(leakReports.documentId, docId));

  // honeytoken_triggers.documentId is NOT NULL, so it's deleted along with the document instead
  await tx.delete(honeytokenTriggers).where(eq(honeytokenTriggers.documentId, docId));

  await tx.delete(documents).where(eq(documents.id, docId));
}

export const listTrash = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization found' });

    const items = await db
      .select()
      .from(trashItems)
      .where(eq(trashItems.organizationId, orgId))
      .orderBy(desc(trashItems.deletedAt));

    // Surface the 30-day countdown so the UI can show "X hari tersisa".
    const now = Date.now();
    const withCountdown = items.map((it) => {
      const ms = it.autoDeleteAt ? new Date(it.autoDeleteAt).getTime() - now : null;
      const daysRemaining = ms != null ? Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000))) : null;
      return { ...it, daysRemaining };
    });

    res.json({ success: true, data: withCountdown });
  } catch (error) {
    console.error('List trash error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trash items' });
  }
};

export const restoreItem = async (req, res) => {
  try {
    const { id } = req.params; // trashItems.id
    const orgId = resolveOrgId(req);

    const [trashItem] = await db.select().from(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.organizationId, orgId)));
    if (!trashItem) return res.status(404).json({ success: false, message: 'Trash item not found' });

    if (trashItem.itemType === 'document') {
      await db.update(documents).set({
        deletedAt: null,
        deletedBy: null,
        status: 'active',
        updatedAt: new Date(),
        folderId: trashItem.originalFolderId || null,
      }).where(eq(documents.id, trashItem.itemId));

    } else if (trashItem.itemType === 'template') {
      await db.update(forms).set({
        isActive: true,
        updatedAt: new Date(),
      }).where(eq(forms.id, trashItem.itemId));
    }

    await db.delete(trashItems).where(eq(trashItems.id, id));

    res.json({ success: true, message: `${trashItem.itemType} restored successfully` });
  } catch (error) {
    console.error('Restore item error:', error);
    res.status(500).json({ success: false, message: 'Failed to restore item' });
  }
};

export const permanentDelete = async (req, res) => {
  try {
    const { id } = req.params; // trashItems.id
    const orgId = resolveOrgId(req);

    const [trashItem] = await db.select().from(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.organizationId, orgId)));
    if (!trashItem) return res.status(404).json({ success: false, message: 'Trash item not found' });

    if (trashItem.itemType === 'document') {
      const itemId = trashItem.itemId;

      const storagePath = path.join(process.cwd(), 'storage', 'documents', itemId);
      try {
        await fs.rm(storagePath, { recursive: true, force: true });
      } catch (err) {
        console.warn('Could not delete storage dir:', err.message);
      }

      const meta = trashItem.itemMetadata || {};
      if (meta.filename) {
        const legacyPath = path.join(process.cwd(), 'uploads', meta.filename);
        try { await fs.unlink(legacyPath); } catch { /* ok */ }
      }

      // Delete DB record (clears FK references first) + remove from trash atomically
      await db.transaction(async (tx) => {
        await hardDeleteDocument(tx, itemId);
        await tx.delete(trashItems).where(eq(trashItems.id, id));
      });

    } else if (trashItem.itemType === 'template') {
      // Hard delete the form + remove from trash atomically
      await db.transaction(async (tx) => {
        await tx.delete(forms).where(eq(forms.id, trashItem.itemId));
        await tx.delete(trashItems).where(eq(trashItems.id, id));
      });
    } else {
      await db.delete(trashItems).where(eq(trashItems.id, id));
    }

    res.json({ success: true, message: 'Item permanently deleted' });
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to permanently delete item' });
  }
};

export const emptyTrash = async (req, res) => {
  try {
    const orgId = resolveOrgId(req);
    if (!orgId) return res.status(400).json({ success: false, message: 'No organization found' });

    const items = await db
      .select()
      .from(trashItems)
      .where(eq(trashItems.organizationId, orgId));

    await db.transaction(async (tx) => {
      for (const item of items) {
        if (item.itemType === 'document') {
          const storagePath = path.join(process.cwd(), 'storage', 'documents', item.itemId);
          try { await fs.rm(storagePath, { recursive: true, force: true }); } catch { /* ok */ }
          const meta = item.itemMetadata || {};
          if (meta.filename) {
            try { await fs.unlink(path.join(process.cwd(), 'uploads', meta.filename)); } catch { /* ok */ }
          }
          await hardDeleteDocument(tx, item.itemId);
        } else if (item.itemType === 'template') {
          await tx.delete(forms).where(eq(forms.id, item.itemId));
        }
      }

      await tx.delete(trashItems).where(eq(trashItems.organizationId, orgId));
    });

    res.json({ success: true, message: `${items.length} items permanently deleted` });
  } catch (error) {
    console.error('Empty trash error:', error);
    res.status(500).json({ success: false, message: 'Failed to empty trash' });
  }
};
