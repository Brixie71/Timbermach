/*
 Navicat Premium Dump SQL

 Source Server         : timberdb
 Source Server Type    : PostgreSQL
 Source Server Version : 170002 (170002)
 Source Host           : localhost:5432
 Source Catalog        : TimberData
 Source Schema         : public

 Target Server Type    : PostgreSQL
 Target Server Version : 170002 (170002)
 File Encoding         : 65001

 Date: 08/02/2025 21:21:11
*/


-- ----------------------------
-- Sequence structure for compressive_data_compressive_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."compressive_data_compressive_id_seq";
CREATE SEQUENCE "public"."compressive_data_compressive_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for flexure_data_flexure_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."flexure_data_flexure_id_seq";
CREATE SEQUENCE "public"."flexure_data_flexure_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for measurement_data_measurement_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."measurement_data_measurement_id_seq";
CREATE SEQUENCE "public"."measurement_data_measurement_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for moisture_data_moisture_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."moisture_data_moisture_id_seq";
CREATE SEQUENCE "public"."moisture_data_moisture_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for shear_data_shear_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."shear_data_shear_id_seq";
CREATE SEQUENCE "public"."shear_data_shear_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Sequence structure for users_user_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."users_user_id_seq";
CREATE SEQUENCE "public"."users_user_id_seq" 
INCREMENT 1
MINVALUE  1
MAXVALUE 2147483647
START 1
CACHE 1;

-- ----------------------------
-- Table structure for compressive_data
-- ----------------------------
DROP TABLE IF EXISTS "public"."compressive_data";
CREATE TABLE "public"."compressive_data" (
  "compressive_id" int4 NOT NULL DEFAULT nextval('compressive_data_compressive_id_seq'::regclass),
  "user_id" int4,
  "timber_name" varchar(255) COLLATE "pg_catalog"."default",
  "timber_image" varchar(255) COLLATE "pg_catalog"."default",
  "comp_test_type" varchar(255) COLLATE "pg_catalog"."default",
  "comp_moisture" numeric(10,2),
  "comp_measure_width" numeric(10,2),
  "comp_measure_height" numeric(10,2),
  "comp_measure_length" numeric(10,2),
  "comp_measure_area" numeric(10,2),
  "comp_strength" numeric(10,2),
  "comp_test_date" date
)
;

-- ----------------------------
-- Records of compressive_data
-- ----------------------------

-- ----------------------------
-- Table structure for flexure_data
-- ----------------------------
DROP TABLE IF EXISTS "public"."flexure_data";
CREATE TABLE "public"."flexure_data" (
  "flexure_id" int4 NOT NULL DEFAULT nextval('flexure_data_flexure_id_seq'::regclass),
  "user_id" int4,
  "timber_name" varchar(255) COLLATE "pg_catalog"."default",
  "timber_image" varchar(255) COLLATE "pg_catalog"."default",
  "flex_moisture" numeric(10,2),
  "flex_measure_width" numeric(10,2),
  "flex_measure_height" numeric(10,2),
  "flex_measure_length" numeric(10,2),
  "flex_measure_area" numeric(10,2),
  "flex_strength" numeric(10,2),
  "flex_test_date" date
)
;

-- ----------------------------
-- Records of flexure_data
-- ----------------------------

-- ----------------------------
-- Table structure for measurement_data
-- ----------------------------
DROP TABLE IF EXISTS "public"."measurement_data";
CREATE TABLE "public"."measurement_data" (
  "measurement_id" int4 NOT NULL DEFAULT nextval('measurement_data_measurement_id_seq'::regclass),
  "user_id" int4,
  "timber_name" varchar(255) COLLATE "pg_catalog"."default",
  "timber_image" varchar(255) COLLATE "pg_catalog"."default",
  "comp_measure_width" numeric(10,2),
  "comp_measure_height" numeric(10,2),
  "comp_measure_length" numeric(10,2),
  "comp_measure_area" numeric(10,2),
  "comp_test_date" date
)
;

-- ----------------------------
-- Records of measurement_data
-- ----------------------------

-- ----------------------------
-- Table structure for moisture_data
-- ----------------------------
DROP TABLE IF EXISTS "public"."moisture_data";
CREATE TABLE "public"."moisture_data" (
  "moisture_id" int4 NOT NULL DEFAULT nextval('moisture_data_moisture_id_seq'::regclass),
  "user_id" int4,
  "timber_name" varchar(255) COLLATE "pg_catalog"."default",
  "timber_image" varchar(255) COLLATE "pg_catalog"."default",
  "moisture_reading" numeric(10,2),
  "moisture_test_date" date
)
;

-- ----------------------------
-- Records of moisture_data
-- ----------------------------

-- ----------------------------
-- Table structure for shear_data
-- ----------------------------
DROP TABLE IF EXISTS "public"."shear_data";
CREATE TABLE "public"."shear_data" (
  "shear_id" int4 NOT NULL DEFAULT nextval('shear_data_shear_id_seq'::regclass),
  "user_id" int4,
  "timber_name" varchar(255) COLLATE "pg_catalog"."default",
  "timber_image" varchar(255) COLLATE "pg_catalog"."default",
  "shear_test_type" varchar(255) COLLATE "pg_catalog"."default",
  "shear_moisture" numeric(10,2),
  "shear_measure_width" numeric(10,2),
  "shear_measure_height" numeric(10,2),
  "shear_measure_length" numeric(10,2),
  "shear_measure_area" numeric(10,2),
  "shear_strength" numeric(10,2),
  "shear_test_date" date
)
;

-- ----------------------------
-- Records of shear_data
-- ----------------------------

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS "public"."users";
CREATE TABLE "public"."users" (
  "user_id" int4 NOT NULL DEFAULT nextval('users_user_id_seq'::regclass),
  "username" varchar(255) COLLATE "pg_catalog"."default",
  "firstname" varchar(255) COLLATE "pg_catalog"."default",
  "lastname" varchar(255) COLLATE "pg_catalog"."default",
  "age" int4,
  "school_email" varchar(255) COLLATE "pg_catalog"."default",
  "mobile_number" int4,
  "gender" varchar(255) COLLATE "pg_catalog"."default",
  "Position" varchar(255) COLLATE "pg_catalog"."default",
  "data_created" varchar(255) COLLATE "pg_catalog"."default",
  "batch_year" varchar(255) COLLATE "pg_catalog"."default",
  "school_year" varchar(255) COLLATE "pg_catalog"."default"
)
;

-- ----------------------------
-- Records of users
-- ----------------------------

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."compressive_data_compressive_id_seq"
OWNED BY "public"."compressive_data"."compressive_id";
SELECT setval('"public"."compressive_data_compressive_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."flexure_data_flexure_id_seq"
OWNED BY "public"."flexure_data"."flexure_id";
SELECT setval('"public"."flexure_data_flexure_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."measurement_data_measurement_id_seq"
OWNED BY "public"."measurement_data"."measurement_id";
SELECT setval('"public"."measurement_data_measurement_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."moisture_data_moisture_id_seq"
OWNED BY "public"."moisture_data"."moisture_id";
SELECT setval('"public"."moisture_data_moisture_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."shear_data_shear_id_seq"
OWNED BY "public"."shear_data"."shear_id";
SELECT setval('"public"."shear_data_shear_id_seq"', 1, false);

-- ----------------------------
-- Alter sequences owned by
-- ----------------------------
ALTER SEQUENCE "public"."users_user_id_seq"
OWNED BY "public"."users"."user_id";
SELECT setval('"public"."users_user_id_seq"', 1, false);

-- ----------------------------
-- Primary Key structure for table compressive_data
-- ----------------------------
ALTER TABLE "public"."compressive_data" ADD CONSTRAINT "compressive_data_pkey" PRIMARY KEY ("compressive_id");

-- ----------------------------
-- Primary Key structure for table flexure_data
-- ----------------------------
ALTER TABLE "public"."flexure_data" ADD CONSTRAINT "flexure_data_pkey" PRIMARY KEY ("flexure_id");

-- ----------------------------
-- Primary Key structure for table measurement_data
-- ----------------------------
ALTER TABLE "public"."measurement_data" ADD CONSTRAINT "measurement_data_pkey" PRIMARY KEY ("measurement_id");

-- ----------------------------
-- Primary Key structure for table moisture_data
-- ----------------------------
ALTER TABLE "public"."moisture_data" ADD CONSTRAINT "moisture_data_pkey" PRIMARY KEY ("moisture_id");

-- ----------------------------
-- Primary Key structure for table shear_data
-- ----------------------------
ALTER TABLE "public"."shear_data" ADD CONSTRAINT "shear_data_pkey" PRIMARY KEY ("shear_id");

-- ----------------------------
-- Primary Key structure for table users
-- ----------------------------
ALTER TABLE "public"."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("user_id");
