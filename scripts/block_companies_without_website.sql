UPDATE Company
SET
  verificationStatus = 'BLOCKED',
  verificationReason = coalesce(verificationReason, '') || CASE
    WHEN coalesce(verificationReason, '') = '' THEN 'Brak strony www'
    ELSE '\nBrak strony www'
  END,
  verificationComment = coalesce(verificationComment, '') || CASE
    WHEN coalesce(verificationComment, '') = '' THEN 'Automatycznie zablokowano: brak adresu strony www'
    ELSE '\nAutomatycznie zablokowano: brak adresu strony www'
  END,
  updatedAt = CURRENT_TIMESTAMP
WHERE (website IS NULL OR trim(website) = '')
  AND verificationStatus != 'BLOCKED';

INSERT INTO BlockedCompany (companyName, reason, createdAt, updatedAt)
SELECT DISTINCT c.name, 'Automatycznie zablokowane: brak strony www', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM Company c
LEFT JOIN BlockedCompany b ON lower(b.companyName) = lower(c.name)
WHERE (c.website IS NULL OR trim(c.website) = '')
  AND b.id IS NULL;
