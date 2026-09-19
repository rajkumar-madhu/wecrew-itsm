-- AddColumn
ALTER TABLE "Organization" ADD COLUMN "alertWebhookToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_alertWebhookToken_key" ON "Organization"("alertWebhookToken");
