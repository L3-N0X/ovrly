-- CreateIndex
CREATE INDEX "Image_userId_idx" ON "Image"("userId");

-- CreateIndex
CREATE INDEX "Editor_editorId_idx" ON "Editor"("editorId");

-- CreateIndex
CREATE INDEX "Editor_editorTwitchName_idx" ON "Editor"("editorTwitchName");

-- CreateIndex
CREATE INDEX "Overlay_userId_idx" ON "Overlay"("userId");

-- CreateIndex
CREATE INDEX "OverlayEditor_editorId_idx" ON "OverlayEditor"("editorId");

-- CreateIndex
CREATE INDEX "OverlayEditor_editorTwitchName_idx" ON "OverlayEditor"("editorTwitchName");

-- CreateIndex
CREATE INDEX "Element_overlayId_position_idx" ON "Element"("overlayId", "position");

-- CreateIndex
CREATE INDEX "Element_parentId_idx" ON "Element"("parentId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Account_providerId_accountId_idx" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");


-- Editor rows used to be linked to their user on every authenticated request.
-- That now happens on sign-in, so link everything that is currently pending once.
UPDATE "Editor" e SET "editorId" = u."id"
FROM "User" u
WHERE e."editorId" IS NULL AND e."editorTwitchName" = u."name";

UPDATE "OverlayEditor" e SET "editorId" = u."id"
FROM "User" u
WHERE e."editorId" IS NULL AND e."editorTwitchName" = u."name";
