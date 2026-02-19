/*
  Warnings:

  - You are about to drop the `Party` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PartyMember` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Party" DROP CONSTRAINT "Party_hostId_fkey";

-- DropForeignKey
ALTER TABLE "PartyMember" DROP CONSTRAINT "PartyMember_partyId_fkey";

-- DropForeignKey
ALTER TABLE "PartyMember" DROP CONSTRAINT "PartyMember_userId_fkey";

-- DropTable
DROP TABLE "Party";

-- DropTable
DROP TABLE "PartyMember";
