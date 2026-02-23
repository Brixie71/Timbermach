-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 23, 2026 at 02:23 PM
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
-- Table structure for table `flexure_data`
--

CREATE TABLE `flexure_data` (
  `flexure_id` bigint(20) UNSIGNED NOT NULL,
  `test_type` varchar(255) NOT NULL,
  `specimen_name` varchar(255) NOT NULL,
  `base` decimal(16,8) NOT NULL,
  `height` decimal(16,8) NOT NULL,
  `length` decimal(16,8) NOT NULL,
  `area` decimal(16,8) NOT NULL,
  `moisture_content` decimal(16,8) DEFAULT NULL,
  `max_force` decimal(16,8) NOT NULL,
  `pressure_bar` double(8,2) DEFAULT NULL,
  `stress` decimal(16,8) DEFAULT NULL,
  `species_id` int(10) UNSIGNED DEFAULT NULL,
  `photo` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `flexure_data`
--

INSERT INTO `flexure_data` (`flexure_id`, `test_type`, `specimen_name`, `base`, `height`, `length`, `area`, `moisture_content`, `max_force`, `pressure_bar`, `stress`, `species_id`, `photo`, `created_at`, `updated_at`) VALUES
(1, 'flexure4fd', 'y7khr4re5t4r', 70.22000122, 69.83000183, 22.60000038, 4903.02001953, 0.00000000, 914.90997314, 186.60, 90.58017731, NULL, NULL, '2025-12-31 01:31:34', '2026-01-14 01:38:28'),
(3, 'Flexuree3eewwerftccv', 'Mango Tremew', 76.40000153, 76.40000153, 580.00000000, 58.36959840, 85.00000000, 7419.00000000, 1000.00, 19963.95312500, 25, NULL, '2026-01-03 00:01:57', '2026-01-15 18:10:44');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `flexure_data`
--
ALTER TABLE `flexure_data`
  ADD PRIMARY KEY (`flexure_id`),
  ADD KEY `flexure_data_species_id_index` (`species_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `flexure_data`
--
ALTER TABLE `flexure_data`
  MODIFY `flexure_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
