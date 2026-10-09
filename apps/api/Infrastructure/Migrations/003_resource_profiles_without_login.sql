ALTER TABLE Users MODIFY PasswordHash varchar(512) NULL;

-- Resource identities remain available to profiles, assignments and historical time.
UPDATE Users SET PasswordHash=NULL, FailedLogins=0, LockedUntil=NULL WHERE Role='Resource';
DELETE s FROM Sessions s JOIN Users u ON u.Id=s.UserId WHERE u.Role='Resource';

ALTER TABLE Users ADD CONSTRAINT CK_Users_LoginCredentials CHECK (
 (Role='Resource' AND PasswordHash IS NULL)
 OR (Role IN ('Admin','Manager') AND PasswordHash IS NOT NULL)
);
