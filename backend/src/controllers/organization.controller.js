import { db } from '../db/index.js';
import { companyProfiles, organizations } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { resolveFeatures } from '../middlewares/superadmin.middleware.js';
import { processImageToDataUrl, imageErrorMessage } from '../services/image-upload.service.js';

// GET /api/organizations/profile — any authenticated user
export const getCompanyProfile = async (req, res) => {
  try {
    const { organizationId } = req.user;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No organization found' });
    }

    const [org] = await db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, companyCode: organizations.companyCode })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    // Profile may not exist yet
    const [profile] = await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.organizationId, organizationId))
      .limit(1);

    res.json({
      success: true,
      data: {
        organization: org || null,
        profile: profile || null,
      },
    });
  } catch (error) {
    console.error('Get company profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch company profile' });
  }
};

// GET /api/organizations/features — per-tenant flags so the UI can hide admin-disabled features
export const getFeatures = async (req, res) => {
  try {
    const { organizationId } = req.user;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No organization found' });
    }
    const [org] = await db
      .select({ settings: organizations.settings, isActive: organizations.isActive })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    return res.json({
      success: true,
      data: { features: resolveFeatures(org || {}), isActive: org?.isActive !== false },
    });
  } catch (error) {
    console.error('Get features error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch features' });
  }
};

// PUT /api/organizations/profile — upsert, owner/admin only
export const updateCompanyProfile = async (req, res) => {
  try {
    const { organizationId } = req.user;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No organization found' });
    }

    const {
      displayName, description, industry, foundedYear, employeeCount,
      contactEmail, phone, website,
      address, city, province, postalCode, country,
      logoUrl, coverUrl, primaryColor, taxId,
    } = req.body;

    const profileData = {
      organizationId,
      displayName: displayName ?? null,
      description: description ?? null,
      industry: industry ?? null,
      foundedYear: foundedYear ? parseInt(foundedYear, 10) : null,
      employeeCount: employeeCount ?? null,
      contactEmail: contactEmail ?? null,
      phone: phone ?? null,
      website: website ?? null,
      address: address ?? null,
      city: city ?? null,
      province: province ?? null,
      postalCode: postalCode ?? null,
      country: country || 'Indonesia',
      logoUrl: logoUrl ?? null,
      coverUrl: coverUrl ?? null,
      primaryColor: primaryColor ?? null,
      taxId: taxId ?? null,
      updatedAt: new Date(),
    };

    const [existing] = await db
      .select({ id: companyProfiles.id })
      .from(companyProfiles)
      .where(eq(companyProfiles.organizationId, organizationId))
      .limit(1);

    let profile;
    if (existing) {
      [profile] = await db
        .update(companyProfiles)
        .set(profileData)
        .where(eq(companyProfiles.organizationId, organizationId))
        .returning();
    } else {
      [profile] = await db
        .insert(companyProfiles)
        .values(profileData)
        .returning();
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Update company profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update company profile' });
  }
};

// POST /api/organizations/profile/upload-image — owner/admin only. Stateless: validates and
// re-encodes the image (magic-byte sniff + sharp → WebP data URL) and returns the URL; the
// client persists it via PUT /profile. Nothing user-supplied survives re-encoding.
export const uploadProfileImage = async (req, res) => {
  try {
    const { organizationId } = req.user;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'No organization found' });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: imageErrorMessage('EMPTY_FILE') });
    }

    const type = req.body?.type === 'cover' ? 'cover' : 'logo';
    let url;
    try {
      url = await processImageToDataUrl(req.file.buffer, type);
    } catch (e) {
      return res.status(400).json({ success: false, message: imageErrorMessage(e.code) });
    }

    res.json({ success: true, data: { url } });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload image' });
  }
};
