-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 23, 2026 at 02:25 PM
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
-- Table structure for table `actuator_calibrations`
--

CREATE TABLE `actuator_calibrations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `midpoint` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Midpoint position (N)',
  `max_distance_left` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Maximum distance left from midpoint (DL)',
  `max_distance_right` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Maximum distance right from midpoint (DR)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Is this calibration active',
  `is_calibrated` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Is calibration complete',
  `notes` text DEFAULT NULL COMMENT 'Additional notes',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `actuator_calibrations`
--

INSERT INTO `actuator_calibrations` (`id`, `midpoint`, `max_distance_left`, `max_distance_right`, `is_active`, `is_calibrated`, `notes`, `created_at`, `updated_at`) VALUES
(1, 490.00, 0.00, 0.00, 1, 0, NULL, '2025-12-29 21:19:47', '2025-12-29 21:19:47');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `actuator_calibrations`
--
ALTER TABLE `actuator_calibrations`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `actuator_calibrations`
--
ALTER TABLE `actuator_calibrations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
