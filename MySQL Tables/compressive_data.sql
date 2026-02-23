-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 23, 2026 at 02:22 PM
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
-- Table structure for table `compressive_data`
--

CREATE TABLE `compressive_data` (
  `compressive_id` bigint(20) UNSIGNED NOT NULL,
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
-- Indexes for dumped tables
--

--
-- Indexes for table `compressive_data`
--
ALTER TABLE `compressive_data`
  ADD PRIMARY KEY (`compressive_id`),
  ADD KEY `compressive_data_species_id_index` (`species_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `compressive_data`
--
ALTER TABLE `compressive_data`
  MODIFY `compressive_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
