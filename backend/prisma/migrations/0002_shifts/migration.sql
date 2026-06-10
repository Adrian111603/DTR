-- CreateTable
CREATE TABLE "Shift" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "amIn" TEXT NOT NULL DEFAULT '08:00',
    "amOut" TEXT NOT NULL DEFAULT '12:00',
    "pmIn" TEXT NOT NULL DEFAULT '13:00',
    "pmOut" TEXT NOT NULL DEFAULT '17:00',
    "regularDays" TEXT NOT NULL DEFAULT 'Monday-Friday',
    "saturdayHours" TEXT,
    "overtimeStart" TEXT,
    "overtimeEnd" TEXT,
    "graceMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "shiftId" INTEGER;

-- AlterTable
ALTER TABLE "DTR" ADD COLUMN "overtimeMinutes" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Shift_name_key" ON "Shift"("name");

-- CreateIndex
CREATE INDEX "Employee_shiftId_idx" ON "Employee"("shiftId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
