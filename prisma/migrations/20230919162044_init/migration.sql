-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('Male', 'Female');

-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('Apple', 'Email', 'Facebook', 'Google');

-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(50) NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "name" TEXT,
    "display_name" TEXT,
    "thumb_url" TEXT,
    "photo_url" TEXT,
    "birth_day" DATE,
    "gender" "Gender",
    "phone" TEXT,
    "locale" TEXT,
    "verified_at" TIMESTAMP(3),
    "last_signed_in" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" VARCHAR(50) NOT NULL,
    "social_id" TEXT,
    "auth_type" "AuthType",
    "refresh_token" TEXT,
    "verification_code" TEXT,
    "verification_code_sent_at" TIMESTAMP(3),
    "user_id" VARCHAR(50) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" VARCHAR(50) NOT NULL,
    "thumb_url" TEXT,
    "thumb_url_high" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" VARCHAR(50) NOT NULL,
    "url" TEXT,
    "name" TEXT,
    "size" BIGINT,
    "type" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "settings_user_id_key" ON "settings"("user_id");

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
