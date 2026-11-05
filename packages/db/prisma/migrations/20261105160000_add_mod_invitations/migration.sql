-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "mod_invitations" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mod_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mod_invitations_competitionId_invitedUserId_key" ON "mod_invitations"("competitionId", "invitedUserId");

-- CreateIndex
CREATE INDEX "mod_invitations_invitedUserId_idx" ON "mod_invitations"("invitedUserId");

-- CreateIndex
CREATE INDEX "mod_invitations_competitionId_idx" ON "mod_invitations"("competitionId");

-- AddForeignKey
ALTER TABLE "mod_invitations" ADD CONSTRAINT "mod_invitations_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_invitations" ADD CONSTRAINT "mod_invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mod_invitations" ADD CONSTRAINT "mod_invitations_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
