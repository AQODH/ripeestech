-- Apply the company-confirmed contact details to existing saved website settings.
UPDATE site_content SET value=json_set(value,'$.email','info@ripees.com','$.phone','+256 787 947343','$.whatsapp','256787947343','$.address','Kampala, Uganda'),revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_by='company-contact-update' WHERE id='website';
