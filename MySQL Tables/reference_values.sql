-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 23, 2026 at 02:24 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `timbermach_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `reference_values`
--

CREATE TABLE `reference_values` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `strength_group` varchar(255) NOT NULL,
  `common_name` varchar(255) NOT NULL,
  `botanical_name` varchar(255) DEFAULT NULL,
  `compression_parallel` decimal(8,2) NOT NULL,
  `compression_perpendicular` decimal(8,2) NOT NULL,
  `shear_parallel` decimal(8,2) NOT NULL,
  `bending_tension_parallel` decimal(8,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `reference_values`
--

INSERT INTO `reference_values` (`id`, `strength_group`, `common_name`, `botanical_name`, `compression_parallel`, `compression_perpendicular`, `shear_parallel`, `bending_tension_parallel`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'high', 'Agoho', 'Casuarina euiteitifolia Forst', 14.50, 5.91, 2.95, 26.30, '2025-11-30 20:57:36', '2025-12-11 22:09:55', NULL),
(2, 'high', 'Luisin', 'Parinari corymbosa (Blume) miq.', 15.60, 4.31, 2.64, 25.00, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(3, 'high', 'Malabayabas', 'Tristania spp.', 15.80, 8.70, 3.02, 28.70, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(4, 'high', 'Manggachapui', 'Hopea spp.', 16.00, 6.03, 2.78, 25.80, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(5, 'high', 'Molave', 'Vitex parviflora Juss.', 15.40, 6.34, 2.88, 24.00, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(6, 'high', 'Narig', 'Vatica spp.', 13.70, 4.97, 2.61, 21.80, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(7, 'high', 'Sasalit', 'Teijmanniodendron ahemianum (Merr) Bkh.', 21.60, 10.20, 3.38, 31.30, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(8, 'high', 'Yakal', 'Shorea spp.', 15.80, 6.27, 2.49, 24.50, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(9, 'moderately_high', 'Antipolo', 'Arthocarpus spp.', 10.80, 3.90, 2.06, 18.60, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(10, 'moderately_high', 'Binggas', 'Terminalia spp.', 11.40, 3.27, 2.24, 18.90, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(11, 'moderately_high', 'Bokbok', 'Xanthophyllum excelsum (Blume) Miq.', 11.30, 3.41, 2.18, 18.10, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(12, 'moderately_high', 'Dao', 'Dracontomelon spp.', 9.44, 3.27, 1.92, 16.20, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(13, 'moderately_high', 'Gatasan', 'Garcla venulosa (Blanco) Choisy', 13.50, 3.52, 2.36, 20.80, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(14, 'moderately_high', 'GUIjo', 'Shore spp.', 13.20, 4.26, 2.40, 21.80, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(15, 'moderately_high', 'Kamagong', 'Diospyros spp.', 11.70, 4.39, 2.47, 20.90, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(16, 'moderately_high', 'Kamatog', 'Erythrophlοeum densiflorum (Elm) Merr.', 11.20, 3.95, 2.35, 19.00, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(17, 'moderately_high', 'Katmon', 'Dillenia spp.', 11.90, 4.84, 2.29, 18.80, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(18, 'moderately_high', 'Kato', 'Amoora spp.', 10.60, 3.46, 1.96, 18.40, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(19, 'moderately_high', 'Lomarau', 'Swintonia foxworthyi Elm.', 11.80, 2.98, 2.18, 19.80, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(20, 'moderately_high', 'Mahogany, Big-leafed', 'Swietenia macrophylla King', 10.50, 3.83, 2.71, 16.50, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(21, 'moderately_high', 'Makaasim', 'Sysygium nitidum Benth', 11.40, 3.70, 2.40, 20.50, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(22, 'moderately_high', 'Malakauayan', 'Decusocarpus philippinensis (Foxw.) de Laub.', 11.12, 2.32, 2.14, 18.90, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(23, 'moderately_high', 'Narra', 'Pterocarpus indicus Willd', 11.40, 3.07, 1.91, 18.00, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(24, 'moderately_high', 'Pahutan', 'Mangifera spp.', 10.00, 2.50, 2.05, 16.60, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(25, 'medium', 'Apitong', 'Dipterocarpus spp.', 9.56, 2.20, 1.73, 16.50, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(26, 'medium', 'Bagtikan', 'Parashorea malaanonan (Blanco) Merr.', 9.89, 2.33, 1.82, 16.60, '2025-11-30 20:57:36', '2025-11-30 20:57:36', NULL),
(27, 'medium', 'SHAWARMA', 'SHARWARMASU', 22.23, 22.22, 44.42, 11.23, '2025-12-11 22:39:30', '2025-12-11 22:56:53', '2025-12-11 22:56:53'),
(32, 'medium', 'Yemane', 'Gmelina arborea R. Br.', 7.87, 3.40, 1.96, 12.60, '2025-12-31 20:48:31', '2025-12-31 20:48:31', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `reference_values`
--
ALTER TABLE `reference_values`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reference_values_common_name_index` (`common_name`),
  ADD KEY `reference_values_botanical_name_index` (`botanical_name`),
  ADD KEY `reference_values_strength_group_index` (`strength_group`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `reference_values`
--
ALTER TABLE `reference_values`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
