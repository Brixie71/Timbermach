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
-- Table structure for table `measurement_detection_settings`
--

CREATE TABLE `measurement_detection_settings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `threshold1` int(11) NOT NULL DEFAULT 52,
  `threshold2` int(11) NOT NULL DEFAULT 104,
  `min_area` int(11) NOT NULL DEFAULT 1000,
  `blur_kernel` int(11) NOT NULL DEFAULT 21,
  `dilation` int(11) NOT NULL DEFAULT 1,
  `erosion` int(11) NOT NULL DEFAULT 1,
  `roi_size` int(11) NOT NULL DEFAULT 60,
  `brightness` int(11) NOT NULL DEFAULT 0,
  `contrast` int(11) NOT NULL DEFAULT 101,
  `mm_per_pixel` decimal(10,6) NOT NULL DEFAULT 0.100000,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `measurement_detection_settings`
--

INSERT INTO `measurement_detection_settings` (`id`, `threshold1`, `threshold2`, `min_area`, `blur_kernel`, `dilation`, `erosion`, `roi_size`, `brightness`, `contrast`, `mm_per_pixel`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 52, 104, 1000, 21, 1, 1, 60, 0, 101, 0.100000, 0, '2026-01-08 06:18:52', '2026-01-08 06:18:56'),
(2, 52, 104, 1000, 21, 1, 1, 60, 0, 101, 0.100000, 0, '2026-01-08 06:18:56', '2026-01-20 05:11:39'),
(3, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:11:39', '2026-01-20 05:11:42'),
(4, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:11:42', '2026-01-20 05:31:00'),
(5, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:31:00', '2026-01-20 05:31:02'),
(6, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:31:02', '2026-01-20 05:54:07'),
(7, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:07', '2026-01-20 05:54:08'),
(8, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:08', '2026-01-20 05:54:09'),
(9, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:09', '2026-01-20 05:54:10'),
(10, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:10', '2026-01-20 05:54:11'),
(11, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:11', '2026-01-20 05:54:11'),
(12, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:11', '2026-01-20 05:54:11'),
(13, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:11', '2026-01-20 05:54:12'),
(14, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:12', '2026-01-20 05:54:12'),
(15, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:12', '2026-01-20 05:54:12'),
(16, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:12', '2026-01-20 05:54:12'),
(17, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:12', '2026-01-20 05:54:20'),
(18, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:20', '2026-01-20 05:54:29'),
(19, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:29', '2026-01-20 05:54:39'),
(20, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 05:54:39', '2026-01-20 07:03:36'),
(21, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 07:03:36', '2026-01-20 07:03:37'),
(22, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-01-20 07:03:37', '2026-02-06 20:21:59'),
(23, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-02-06 20:21:59', '2026-02-06 20:27:43'),
(24, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-02-06 20:27:43', '2026-02-06 20:27:45'),
(25, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-02-06 20:27:45', '2026-02-06 20:27:46'),
(26, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-02-06 20:27:46', '2026-02-06 20:27:46'),
(27, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 0, '2026-02-06 20:27:46', '2026-02-06 20:27:47'),
(28, 52, 104, 1000, 21, 1, 1, 65, 0, 101, 0.128800, 1, '2026-02-06 20:27:47', '2026-02-06 20:27:47');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `measurement_detection_settings`
--
ALTER TABLE `measurement_detection_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `measurement_detection_settings_is_active_index` (`is_active`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `measurement_detection_settings`
--
ALTER TABLE `measurement_detection_settings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
