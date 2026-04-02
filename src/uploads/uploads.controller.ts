import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { extname, join } from "path";
import { v4 as uuidv4 } from "uuid";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";

const UPLOAD_DIR = join(process.cwd(), "uploads");

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
]);

/** Only serve files we created (uuid + safe extension). */
const STORED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;

function ensureUploadDir(): void {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

@Controller("uploads")
export class UploadsController {
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 50 * 1024 * 1024 },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const safe =
            ext && /^\.[a-z0-9]+$/.test(ext) && ext.length <= 8 ? ext : "";
          cb(null, `${uuidv4()}${safe}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMES.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Unsupported file type: ${file.mimetype}. Allowed: images, video (mp4/webm/mov), PDF.`,
            ),
            false,
          );
        }
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException("Missing file");
    }
    return {
      url: `/api/uploads/${file.filename}`,
      mime: file.mimetype,
      name: file.originalname,
      sizeBytes: file.size,
    };
  }

  @Get(":filename")
  serve(@Param("filename") filename: string, @Res() res: Response): void {
    if (!STORED_NAME.test(filename)) {
      throw new NotFoundException();
    }
    const full = join(UPLOAD_DIR, filename);
    if (!existsSync(full)) {
      throw new NotFoundException();
    }
    res.sendFile(full);
  }
}
