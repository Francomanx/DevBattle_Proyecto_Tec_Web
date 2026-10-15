-- Limpiar tablas para permitir el cambio de tipos ENUM
TRUNCATE TABLE "votes", "comments", "messages", "notifications", "group_members", "friendships", "projects", "metrics", "competition_participants", "competitions", "users" CASCADE;

-- AlterEnum CompetitionRole
CREATE TYPE "CompetitionRole_new" AS ENUM ('HOST', 'MOD', 'DEV');
ALTER TABLE "competition_participants" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "competition_participants" ALTER COLUMN "role" TYPE "CompetitionRole_new" USING ("role"::text::"CompetitionRole_new");
ALTER TYPE "CompetitionRole" RENAME TO "CompetitionRole_old";
ALTER TYPE "CompetitionRole_new" RENAME TO "CompetitionRole";
DROP TYPE "CompetitionRole_old";
ALTER TABLE "competition_participants" ALTER COLUMN "role" SET DEFAULT 'DEV';

-- AlterEnum CompetitionStatus
CREATE TYPE "CompetitionStatus_new" AS ENUM ('DRAFT', 'ACTIVE', 'VOTING', 'COMPLETED');
ALTER TABLE "competitions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "competitions" ALTER COLUMN "status" TYPE "CompetitionStatus_new" USING ("status"::text::"CompetitionStatus_new");
ALTER TYPE "CompetitionStatus" RENAME TO "CompetitionStatus_old";
ALTER TYPE "CompetitionStatus_new" RENAME TO "CompetitionStatus";
DROP TYPE "CompetitionStatus_old";
ALTER TABLE "competitions" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterEnum FriendshipStatus
CREATE TYPE "FriendshipStatus_new" AS ENUM ('PENDING', 'ACCEPTED');
ALTER TABLE "friendships" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "friendships" ALTER COLUMN "status" TYPE "FriendshipStatus_new" USING ("status"::text::"FriendshipStatus_new");
ALTER TYPE "FriendshipStatus" RENAME TO "FriendshipStatus_old";
ALTER TYPE "FriendshipStatus_new" RENAME TO "FriendshipStatus";
DROP TYPE "FriendshipStatus_old";
ALTER TABLE "friendships" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterEnum GroupRole
CREATE TYPE "GroupRole_new" AS ENUM ('MEMBER', 'ADMIN');
ALTER TABLE "group_members" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "group_members" ALTER COLUMN "role" TYPE "GroupRole_new" USING ("role"::text::"GroupRole_new");
ALTER TYPE "GroupRole" RENAME TO "GroupRole_old";
ALTER TYPE "GroupRole_new" RENAME TO "GroupRole";
DROP TYPE "GroupRole_old";
ALTER TABLE "group_members" ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- AlterEnum MetricType
CREATE TYPE "MetricType_new" AS ENUM ('OBJECTIVE', 'SUBJECTIVE');
ALTER TABLE "metrics" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "metrics" ALTER COLUMN "type" TYPE "MetricType_new" USING ("type"::text::"MetricType_new");
ALTER TYPE "MetricType" RENAME TO "MetricType_old";
ALTER TYPE "MetricType_new" RENAME TO "MetricType";
DROP TYPE "MetricType_old";
ALTER TABLE "metrics" ALTER COLUMN "type" SET DEFAULT 'OBJECTIVE';

-- AlterEnum NotificationType
CREATE TYPE "NotificationType_new" AS ENUM ('STATE_CHANGE', 'DISQUALIFICATION', 'MOD_REMOVAL', 'MESSAGE');
ALTER TABLE "notifications" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'STATE_CHANGE';
