// DocuSeal API Service — wrapper for e-signing via DocuSeal

import fs from 'fs/promises';
import path from 'path';

const DOCUSEAL_API_URL = process.env.DOCUSEAL_API_URL || 'https://api.docuseal.com';
const DOCUSEAL_API_KEY = process.env.DOCUSEAL_API_KEY;

async function docusealFetch(endpoint, options = {}) {
  const url = `${DOCUSEAL_API_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'X-Auth-Token': DOCUSEAL_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`[DocuSeal] API error ${res.status} on ${endpoint}:`, errorBody);
    throw new Error(`DocuSeal API error: ${res.status} — ${errorBody}`);
  }

  return res.json();
}

// One-off submission straight from a PDF — no template needed.
export async function createSubmissionFromPDF(pdfBuffer, documentName, signer, options = {}) {
  const base64 = pdfBuffer.toString('base64');

  const fields = [];

  if (options.signatureField !== false) {
    fields.push({
      name: 'Signature',
      type: 'signature',
      role: signer.role || 'First Party',
      areas: options.signatureAreas || [
        {
          x: 0.1,      // 10% from left
          y: 0.85,     // 85% from top (near bottom)
          w: 0.35,     // 35% width
          h: 0.08,     // 8% height
          page: -1,    // Last page
        },
      ],
    });
  }

  if (options.extraFields && Array.isArray(options.extraFields)) {
    fields.push(...options.extraFields);
  }

  const body = {
    name: documentName,
    send_email: options.sendEmail ?? false, // Default: don't send email (we embed instead)
    order: 'preserved',
    documents: [
      {
        name: documentName,
        file: base64,
        fields: fields.length > 0 ? fields : undefined,
      },
    ],
    submitters: [
      {
        role: signer.role || 'First Party',
        email: signer.email,
        name: signer.name || undefined,
        send_email: false, // Embed instead
        completed_redirect_url: options.completedRedirectUrl || undefined,
      },
    ],
  };

  if (options.expireAt) {
    body.expire_at = options.expireAt;
  }

  const result = await docusealFetch('/submissions/pdf', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return result;
}

export async function createSubmissionFromTemplate(templateId, signer, options = {}) {
  const body = {
    template_id: templateId,
    send_email: options.sendEmail ?? false,
    order: 'preserved',
    submitters: [
      {
        role: signer.role || 'First Party',
        email: signer.email,
        name: signer.name || undefined,
        send_email: false,
      },
    ],
  };

  return docusealFetch('/submissions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getSubmission(submissionId) {
  return docusealFetch(`/submissions/${submissionId}`);
}

// Returns the signed PDFs.
export async function getSubmissionDocuments(submissionId) {
  return docusealFetch(`/submissions/${submissionId}/documents`);
}

export async function getSubmitter(submitterId) {
  return docusealFetch(`/submitters/${submitterId}`);
}

export async function listSubmitters(submissionId) {
  return docusealFetch(`/submitters?submission_id=${submissionId}`);
}

export async function createTemplateFromPDF(pdfBuffer, name, options = {}) {
  const base64 = pdfBuffer.toString('base64');

  const fields = [];
  if (options.signatureField !== false) {
    fields.push({
      name: 'Signature',
      type: 'signature',
      role: 'First Party',
    });
  }

  return docusealFetch('/templates/pdf', {
    method: 'POST',
    body: JSON.stringify({
      name,
      documents: [
        {
          name,
          file: base64,
          fields: fields.length > 0 ? fields : undefined,
        },
      ],
    }),
  });
}

export async function listTemplates(options = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit);
  if (options.q) params.append('q', options.q);
  const qs = params.toString();
  return docusealFetch(`/templates${qs ? '?' + qs : ''}`);
}

export async function getTemplate(templateId) {
  return docusealFetch(`/templates/${templateId}`);
}

export async function downloadSignedDocument(url, savePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download signed document: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(savePath), { recursive: true });
  await fs.writeFile(savePath, buffer);

  return { savePath, size: buffer.length, buffer };
}

export default {
  createSubmissionFromPDF,
  createSubmissionFromTemplate,
  getSubmission,
  getSubmissionDocuments,
  getSubmitter,
  listSubmitters,
  createTemplateFromPDF,
  listTemplates,
  getTemplate,
  downloadSignedDocument,
};
