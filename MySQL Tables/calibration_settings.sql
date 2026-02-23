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
-- Table structure for table `calibration_settings`
--

CREATE TABLE `calibration_settings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `setting_type` varchar(255) NOT NULL DEFAULT 'seven_segment',
  `device_name` varchar(255) DEFAULT NULL,
  `display_box` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`display_box`)),
  `segment_boxes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`segment_boxes`)),
  `calibration_image_size` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`calibration_image_size`)),
  `num_digits` int(11) NOT NULL DEFAULT 3,
  `has_decimal_point` tinyint(1) NOT NULL DEFAULT 0,
  `decimal_position` int(11) NOT NULL DEFAULT 1 COMMENT 'Position from right: 1=XX.X, 2=X.XX',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `calibration_settings`
--

INSERT INTO `calibration_settings` (`id`, `setting_type`, `device_name`, `display_box`, `segment_boxes`, `calibration_image_size`, `num_digits`, `has_decimal_point`, `decimal_position`, `is_active`, `notes`, `created_at`, `updated_at`) VALUES
(17, 'seven_segment', 'Moisture Meter', '{\"x\":0,\"y\":0,\"width\":1344,\"height\":768}', '[[{\"x\":108.78688524590164,\"y\":56.46014624716331,\"width\":150.09836065573768,\"height\":75.739220575463},{\"x\":285.04918032786884,\"y\":108.78906228111956,\"width\":74.36065573770492,\"height\":229.97181520186032},{\"x\":286.42622950819674,\"y\":451.68116997730647,\"width\":72.98360655737702,\"height\":221.70935477544617},{\"x\":104.65573770491802,\"y\":658.2426806376601,\"width\":156.98360655737707,\"height\":70.23091362452021},{\"x\":12.39344262295082,\"y\":443.41870955089234,\"width\":81.24590163934427,\"height\":199.6761269716751},{\"x\":12.39344262295082,\"y\":148.72428767545458,\"width\":78.49180327868852,\"height\":191.41366654526095},{\"x\":103.27868852459017,\"y\":358.03995181127954,\"width\":156.98360655737702,\"height\":71.60799036225592}],[{\"x\":524.655737704918,\"y\":45.44353234527779,\"width\":191.4098360655738,\"height\":74.36214383772729},{\"x\":738.0983606557377,\"y\":67.47676014904883,\"width\":82.62295081967216,\"height\":272.6611940716667},{\"x\":738.0983606557377,\"y\":457.18947692824923,\"width\":78.49180327868851,\"height\":235.48012215280306},{\"x\":579.7377049180328,\"y\":676.144678228224,\"width\":123.93442622950818,\"height\":55.08306950942756},{\"x\":490.2295081967213,\"y\":446.1728630263637,\"width\":77.11475409836066,\"height\":212.0698176112964},{\"x\":481.9672131147541,\"y\":134.95352029809766,\"width\":66.09836065573774,\"height\":187.28243633205392},{\"x\":583.8688524590164,\"y\":355.2857983358081,\"width\":125.31147540983613,\"height\":63.345529935841796}],[{\"x\":1063.0819672131147,\"y\":46.82060908301348,\"width\":152.85245901639337,\"height\":75.73922057546298},{\"x\":1229.704918032787,\"y\":79.87045078867006,\"width\":85.37704918032773,\"height\":261.6445801697812},{\"x\":1240.7213114754097,\"y\":433.7791723867425,\"width\":68.8524590163936,\"height\":249.25088953015995},{\"x\":1058.950819672131,\"y\":644.4719132603032,\"width\":158.36065573770497,\"height\":78.49337405093434},{\"x\":959.8032786885245,\"y\":433.7791723867425,\"width\":84.00000000000011,\"height\":192.7907432829967},{\"x\":966.6885245901639,\"y\":132.1993668226263,\"width\":71.60655737704917,\"height\":191.41366654526098},{\"x\":1056.1967213114754,\"y\":344.26918443392265,\"width\":161.11475409836066,\"height\":78.49337405093434}]]', '{\"width\":1344,\"height\":768}', 3, 1, 1, 0, 'Created from calibration wizard', '2026-01-03 07:13:31', '2026-01-15 22:25:19'),
(18, 'seven_segment', 'Moisture Meter', '{\"x\":0,\"y\":0,\"width\":1280,\"height\":720}', '[[{\"x\":313.44262295081967,\"y\":177.04918032786884,\"width\":68.19672131147536,\"height\":40.65573770491804},{\"x\":397.37704918032784,\"y\":191.47540983606555,\"width\":43.278688524590166,\"height\":140.32786885245903},{\"x\":398.6885245901639,\"y\":403.9344262295082,\"width\":38.032786885245855,\"height\":137.70491803278685},{\"x\":304.2622950819672,\"y\":519.3442622950819,\"width\":70.81967213114757,\"height\":45.90163934426232},{\"x\":254.4262295081967,\"y\":409.18032786885243,\"width\":40.65573770491804,\"height\":90.49180327868851},{\"x\":245.24590163934425,\"y\":236.0655737704918,\"width\":47.21311475409834,\"height\":97.04918032786881},{\"x\":301.6393442622951,\"y\":346.22950819672127,\"width\":79.99999999999994,\"height\":44.59016393442624}],[{\"x\":552.1311475409835,\"y\":170.4918032786885,\"width\":74.7540983606558,\"height\":49.8360655737705},{\"x\":633.4426229508197,\"y\":190.1639344262295,\"width\":49.8360655737705,\"height\":139.01639344262293},{\"x\":630.8196721311475,\"y\":394.7540983606557,\"width\":49.8360655737705,\"height\":137.70491803278685},{\"x\":544.2622950819672,\"y\":511.4754098360655,\"width\":77.37704918032784,\"height\":47.21311475409834},{\"x\":487.86885245901635,\"y\":402.6229508196721,\"width\":43.278688524590166,\"height\":104.91803278688525},{\"x\":486.5573770491803,\"y\":229.50819672131146,\"width\":55.08196721311475,\"height\":102.29508196721312},{\"x\":548.1967213114754,\"y\":343.60655737704917,\"width\":80,\"height\":43.278688524590166}],[{\"x\":788.1967213114754,\"y\":163.93442622950818,\"width\":76.06557377049182,\"height\":57.70491803278688},{\"x\":872.1311475409835,\"y\":180.98360655737704,\"width\":47.21311475409834,\"height\":153.44262295081964},{\"x\":865.5737704918032,\"y\":396.06557377049177,\"width\":48.52459016393448,\"height\":136.39344262295077},{\"x\":780.327868852459,\"y\":504.9180327868852,\"width\":78.68852459016387,\"height\":49.8360655737705},{\"x\":731.8032786885245,\"y\":398.6885245901639,\"width\":41.967213114754145,\"height\":99.67213114754094},{\"x\":727.8688524590164,\"y\":226.88524590163934,\"width\":55.081967213114694,\"height\":106.22950819672127},{\"x\":788.1967213114754,\"y\":340.983606557377,\"width\":73.44262295081967,\"height\":45.90163934426232}]]', '{\"width\":1280,\"height\":720}', 3, 1, 1, 1, 'Created from calibration wizard', '2026-01-10 03:16:59', '2026-01-15 22:25:19');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `calibration_settings`
--
ALTER TABLE `calibration_settings`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `calibration_settings`
--
ALTER TABLE `calibration_settings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
