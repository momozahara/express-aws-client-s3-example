import dotenv from "dotenv";
dotenv.config();

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsCommand,
} from "@aws-sdk/client-s3";

import express from "express";
import path from "path";
import multer from "multer";

const __workdir = process.cwd();

const app = express();

const bucket = process.env.bucket_name;
const client = new S3Client({
  region: process.env.region,
  credentials: {
    accessKeyId: process.env.aws_access_key_id!,
    secretAccessKey: process.env.aws_secret_access_key!,
  },
});

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__workdir, "index.html"));
});

app.get("/lists", (req, res) => {
  const command = new ListObjectsCommand({
    Bucket: bucket,
  });
  client.send(command).then(
    (data) => {
      if (data.Contents) {
        data.Contents.forEach((element) => {
          res.write(
            `<a style="display: block" href="/static/${element.Key}">${element.Key}</a>`,
          );
        });
      }
      res.end();
    },
    () => {
      res.sendFile(path.join(__workdir, "400.html"));
    },
  );
});

app.use("/static/:filename", (req, res) => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: req.params.filename,
  });
  client.send(command).then(
    async (data) => {
      if (data.Body) {
        res.contentType(data.ContentType!);

        res.write(await data.Body.transformToByteArray(), "binary");
        res.end(null, "binary");
      }
    },
    () => {
      res.sendFile(path.join(__workdir, "404.html"));
    },
  );
});

app.post("/upload", upload.single("image"), (req, res) => {
  if (req.file !== undefined) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename =
      req.file.fieldname +
      "-" +
      uniqueSuffix +
      path.extname(req.file.originalname);

    const command = new PutObjectCommand({
      Body: req.file.buffer,
      Bucket: bucket,
      Key: filename,
      ContentType: req.file.mimetype,
    });
    client.send(command).then(
      () => {
        res.redirect("/static/" + filename);
      },
      () => {
        res.sendFile(path.join(__workdir, "400.html"));
      },
    );
  }
});

app.listen(8888, "0.0.0.0");
