/**
 * Image Processing Configuration
 * Adjust these settings to control image quality, dimensions, and format
 */

export const imageConfig = {
  // Target dimensions (16:9 aspect ratio)
  // Smaller dimensions = smaller file size
  width: 560, // 640
  height: 315, // 360

  // JPEG quality (0.0 to 1.0)
  // Lower values = smaller file size but lower quality
  // Recommended range: 0.75 - 0.90 for good balance
  quality: 0.85,

  // Image format for output
  // Options: "image/jpeg" or "image/png"
  // JPEG is smaller, PNG is lossless but larger
  format: "image/jpeg" as "image/jpeg" | "image/png",

  // File extension based on format
  get extension(): string {
    return this.format === "image/png" ? "png" : "jpg"
  }
}
