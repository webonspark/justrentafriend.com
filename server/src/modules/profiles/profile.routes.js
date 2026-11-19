const express = require("express");
const service = require("./profile.service");
const { wrap } = require("../../lib/handler");
const { imageUpload } = require("../../lib/uploads");
const { requireAuth, optionalAuth } = require("../../middleware/auth");

/**
 *   GET    /profiles/catalog            services, interests, languages, place types
 *   GET    /profiles/me                 my profile, photos, checklist, KYC
 *   PUT    /profiles/me                 edit about, services, rate, interests
 *   PUT    /profiles/me/availability    replace the weekly calendar
 *   POST   /profiles/me/photos          upload a photo (moderated)
 *   DELETE /profiles/me/photos/:id
 *   POST   /profiles/me/photos/:id/primary
 *   POST   /profiles/me/kyc             Aadhaar / PAN + document image
 *   POST   /profiles/me/selfie          selfie, matched to the primary photo
 *   POST   /profiles/me/submit          Companion asks to go live
 *   PUT    /profiles/me/payout-account  UPI or bank for payouts
 *   GET    /profiles/:id                a Companion's public page
 */
const router = express.Router();

router.get("/catalog", wrap(async (req, res) => res.json(await service.catalog())));

router.get("/me", requireAuth, wrap(async (req, res) => res.json(await service.getMine(req.user.id))));
router.put("/me", requireAuth, wrap(async (req, res) => res.json(await service.updateMine(req.user, req.body))));
router.put(
  "/me/availability",
  requireAuth,
  wrap(async (req, res) => res.json(await service.setAvailability(req.user, req.body.slots)))
);

router.post(
  "/me/photos",
  requireAuth,
  imageUpload.single("photo"),
  wrap(async (req, res) => res.status(201).json(await service.addPhoto(req.user, req.file)))
);
router.delete(
  "/me/photos/:id",
  requireAuth,
  wrap(async (req, res) => res.json(await service.deletePhoto(req.user, req.params.id)))
);
router.post(
  "/me/photos/:id/primary",
  requireAuth,
  wrap(async (req, res) => res.json(await service.setPrimaryPhoto(req.user, req.params.id)))
);

router.post(
  "/me/kyc",
  requireAuth,
  imageUpload.single("document"),
  wrap(async (req, res) => res.status(201).json(await service.submitKyc(req.user, req.body, req.file)))
);
router.post(
  "/me/selfie",
  requireAuth,
  imageUpload.single("selfie"),
  wrap(async (req, res) => res.status(201).json(await service.submitSelfie(req.user, req.file)))
);
router.post("/me/submit", requireAuth, wrap(async (req, res) => res.json(await service.submitForApproval(req.user))));
router.put(
  "/me/payout-account",
  requireAuth,
  wrap(async (req, res) => res.json(await service.savePayoutAccount(req.user, req.body)))
);

router.get("/:id(\\d+)", optionalAuth, wrap(async (req, res) => res.json(await service.getPublic(req.params.id, req.user))));

module.exports = router;
