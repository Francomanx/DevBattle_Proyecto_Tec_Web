CREATE TABLE "password_change_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_change_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "password_change_codes_userId_createdAt_idx"
ON "password_change_codes"("userId", "createdAt");

ALTER TABLE "password_change_codes"
ADD CONSTRAINT "password_change_codes_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
