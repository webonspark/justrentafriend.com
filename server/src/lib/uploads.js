const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const sharp = require("sharp");
const env = require("../config/env");
const { badRequest } = require("./errors");

/**
 * Image uploads.
 *
 * Files are held in memory by multer, then re-encoded by sharp: that strips
 * EXIF (so a photo never leaks where it was taken), normalises the format
 * and makes a thumbnail. Only the re-encoded file is written to disk.
 *
 * Private files (KYC documents, selfies) go under uploads/private, which is
 * never served statically; they are streamed only to admins, and each view
 * is written to the audit log.
 */

const ROOT = path.join(process.cwd(), env.uploads.dir);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploads.maxMb * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      return cb(badRequest("Upload a JPG, PNG or WebP image."));
    }
    return cb(null, true);
  },
});

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Saves a public photo and its thumbnail. Returns paths relative to ROOT. */
async function savePhoto(buffer, folder = "photos") {
  const dir = path.join(ROOT, folder);
  ensureDir(dir);
  const name = crypto.randomBytes(12).toString("hex");
  await sharp(buffer).rotate().resize(1200, 1200, { fit: "inside" }).jpeg({ quality: 82 }).toFile(path.join(dir, `${name}.jpg`));
  await sharp(buffer).rotate().resize(400, 400, { fit: "cover" }).jpeg({ quality: 75 }).toFile(path.join(dir, `${name}_t.jpg`));
  return { path: `${folder}/${name}.jpg`, thumbPath: `${folder}/${name}_t.jpg` };
}

/** Saves a private file (KYC, selfie). Never served statically. */
async function savePrivate(buffer, folder) {
  const dir = path.join(ROOT, "private", folder);
  ensureDir(dir);
  const name = `${crypto.randomBytes(12).toString("hex")}.jpg`;
  await sharp(buffer).rotate().resize(1600, 1600, { fit: "inside" }).jpeg({ quality: 85 }).toFile(path.join(dir, name));
  return `private/${folder}/${name}`;
}

const absolute = (rel) => path.join(ROOT, rel);

/** "/uploads/photos/abc.jpg" for the browser. */
const publicUrl = (rel) => (rel ? `/${env.uploads.dir}/${rel}` : null);

function remove(rel) {
  if (!rel) return;
  fs.promises.unlink(absolute(rel)).catch(() => {});
}

module.exports = { imageUpload, savePhoto, savePrivate, absolute, publicUrl, remove };
