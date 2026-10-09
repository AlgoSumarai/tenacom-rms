CREATE TABLE Users (
 Id char(36) PRIMARY KEY, Email varchar(254) NOT NULL, Name varchar(120) NOT NULL,
 PasswordHash varchar(512) NOT NULL, Role varchar(16) NOT NULL, Active boolean NOT NULL DEFAULT true,
 FailedLogins int NOT NULL DEFAULT 0, LockedUntil datetime(6) NULL,
 Version int NOT NULL DEFAULT 1, CreatedAt datetime(6) NOT NULL, UpdatedAt datetime(6) NOT NULL,
 CONSTRAINT UQ_Users_Email UNIQUE(Email), CHECK (Role IN ('Admin','Manager','Resource')),
 INDEX IX_Users_RoleActiveName (Role,Active,Name)
);
CREATE TABLE Sessions (
 TokenHash char(64) PRIMARY KEY, UserId char(36) NOT NULL, ExpiresAt datetime(6) NOT NULL,
 FOREIGN KEY (UserId) REFERENCES Users(Id), INDEX IX_Sessions_User (UserId), INDEX IX_Sessions_Expiry (ExpiresAt)
);
CREATE TABLE ResourceProfiles (
 UserId char(36) PRIMARY KEY, Headline varchar(160) NOT NULL DEFAULT '', Summary text NOT NULL,
 Phone varchar(40) NOT NULL DEFAULT '', Location varchar(120) NOT NULL DEFAULT '',
 Status varchar(20) NOT NULL DEFAULT 'Available', ReviewStatus varchar(20) NOT NULL DEFAULT 'Pending',
 ReviewNote varchar(1000) NOT NULL DEFAULT '', ConsentAt datetime(6) NULL,
 Version int NOT NULL DEFAULT 1, UpdatedAt datetime(6) NOT NULL,
 FOREIGN KEY (UserId) REFERENCES Users(Id),
 CHECK (Status IN ('Available','Limited','Unavailable')),
 CHECK (ReviewStatus IN ('Pending','Verified','NeedsChanges')), INDEX IX_Profiles_Status (Status,UserId)
);
CREATE TABLE VocabularyTerms (
 Id char(36) PRIMARY KEY, Kind varchar(16) NOT NULL, Name varchar(100) NOT NULL,
 UNIQUE(Kind,Name), CHECK (Kind IN ('Field','Industry','Skill','Expertise'))
);
CREATE TABLE ProfileTerms (
 ResourceId char(36) NOT NULL, TermId char(36) NOT NULL, Proficiency varchar(16) NOT NULL DEFAULT 'Practitioner',
 Years int NULL, PRIMARY KEY(ResourceId,TermId),
 FOREIGN KEY(ResourceId) REFERENCES ResourceProfiles(UserId), FOREIGN KEY(TermId) REFERENCES VocabularyTerms(Id),
 CHECK(Proficiency IN ('Learning','Practitioner','Advanced','Expert')), CHECK(Years IS NULL OR Years BETWEEN 0 AND 80),
 INDEX IX_ProfileTerms_Search (TermId,ResourceId)
);
CREATE TABLE Projects (
 Id char(36) PRIMARY KEY, Code varchar(30) NOT NULL UNIQUE, Name varchar(160) NOT NULL,
 Description text NOT NULL, Status varchar(16) NOT NULL, StartDate date NOT NULL, EndDate date NULL,
 Version int NOT NULL DEFAULT 1, CreatedBy char(36) NOT NULL, CreatedAt datetime(6) NOT NULL, UpdatedAt datetime(6) NOT NULL,
 FOREIGN KEY(CreatedBy) REFERENCES Users(Id), CHECK(EndDate IS NULL OR EndDate >= StartDate),
 CHECK(Status IN ('Planned','Active','Completed','Archived')), INDEX IX_Projects_StatusName (Status,Name)
);
CREATE TABLE Assignments (
 Id char(36) PRIMARY KEY, ProjectId char(36) NOT NULL, ResourceId char(36) NOT NULL,
 RoleDescription varchar(160) NOT NULL, StartDate date NOT NULL, EndDate date NULL,
 Version int NOT NULL DEFAULT 1, CreatedBy char(36) NOT NULL, CreatedAt datetime(6) NOT NULL, UpdatedAt datetime(6) NOT NULL,
 FOREIGN KEY(ProjectId) REFERENCES Projects(Id), FOREIGN KEY(ResourceId) REFERENCES ResourceProfiles(UserId),
 FOREIGN KEY(CreatedBy) REFERENCES Users(Id), CHECK(EndDate IS NULL OR EndDate >= StartDate),
 INDEX IX_Assignments_ResourceProject (ResourceId,ProjectId,StartDate), INDEX IX_Assignments_Project (ProjectId,StartDate)
);
CREATE TABLE TimeEntries (
 Id char(36) PRIMARY KEY, AssignmentId char(36) NOT NULL, WorkDate date NOT NULL, Minutes int NOT NULL,
 Notes varchar(1000) NOT NULL, Version int NOT NULL DEFAULT 1, CreatedBy char(36) NOT NULL,
 CreatedAt datetime(6) NOT NULL, UpdatedAt datetime(6) NOT NULL, DeletedAt datetime(6) NULL,
 FOREIGN KEY(AssignmentId) REFERENCES Assignments(Id), FOREIGN KEY(CreatedBy) REFERENCES Users(Id),
 CHECK(Minutes BETWEEN 1 AND 1440), INDEX IX_Time_AssignmentDate (AssignmentId,WorkDate,DeletedAt), INDEX IX_Time_Date (WorkDate,DeletedAt)
);
CREATE TABLE Invitations (
 Id char(36) PRIMARY KEY, TokenHash char(64) NOT NULL UNIQUE, Label varchar(120) NOT NULL,
 ExpiresAt datetime(6) NOT NULL, MaxUses int NOT NULL, Uses int NOT NULL DEFAULT 0, Revoked boolean NOT NULL DEFAULT false,
 CreatedBy char(36) NOT NULL, CreatedAt datetime(6) NOT NULL,
 FOREIGN KEY(CreatedBy) REFERENCES Users(Id), CHECK(MaxUses BETWEEN 1 AND 10000), CHECK(Uses >= 0 AND Uses <= MaxUses)
);
CREATE TABLE AuditEvents (
 Id bigint AUTO_INCREMENT PRIMARY KEY, ActorId char(36) NULL, Action varchar(60) NOT NULL,
 EntityId varchar(36) NOT NULL, OccurredAt datetime(6) NOT NULL,
 Details json NOT NULL, FOREIGN KEY(ActorId) REFERENCES Users(Id), INDEX IX_Audit_Date (OccurredAt)
);
