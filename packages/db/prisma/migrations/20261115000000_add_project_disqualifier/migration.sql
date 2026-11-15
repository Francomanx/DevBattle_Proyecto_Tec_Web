ALTER TABLE "projects"
ADD COLUMN "disqualifiedById" TEXT;

ALTER TABLE "projects"
ADD CONSTRAINT "projects_disqualifiedById_fkey"
FOREIGN KEY ("disqualifiedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "projects_disqualifiedById_idx"
ON "projects"("disqualifiedById");
