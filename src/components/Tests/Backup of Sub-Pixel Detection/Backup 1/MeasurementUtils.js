/**
 * Utility functions for measurement operations
 */

// Convert from pixel measurements to millimeters
export const pixelsToMillimeters = (pixelValue, calibrationFactor) => {
    return pixelValue * calibrationFactor;
  };
  
  // Calculate calibration factor if a reference object is present
  export const calculateCalibrationFactor = (referencePixels, referenceMillimeters) => {
    if (referencePixels <= 0) {
      console.error("Reference pixels must be greater than zero");
      return 0.0145503; // Default value
    }
    return referenceMillimeters / referencePixels;
  };
  
  // Calculate statistics for multiple measurements
  export const calculateMeasurementStatistics = (measurements) => {
    if (!measurements || measurements.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        count: 0
      };
    }
    
    // Sort measurements for percentile calculations
    const sortedMeasurements = [...measurements].sort((a, b) => a - b);
    
    // Calculate basic statistics
    const count = measurements.length;
    const sum = measurements.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;
    const min = sortedMeasurements[0];
    const max = sortedMeasurements[count - 1];
    
    // Calculate median
    const midIndex = Math.floor(count / 2);
    const median = count % 2 === 0 ? 
      (sortedMeasurements[midIndex - 1] + sortedMeasurements[midIndex]) / 2 : 
      sortedMeasurements[midIndex];
    
    // Calculate standard deviation
    const sumOfSquaredDiff = measurements.reduce((acc, val) => {
      const diff = val - mean;
      return acc + (diff * diff);
    }, 0);
    const stdDev = Math.sqrt(sumOfSquaredDiff / count);
    
    return {
      min,
      max,
      mean,
      median,
      stdDev,
      count
    };
  };
  
  // Format measurement for display
  export const formatMeasurement = (value, units, precision = 2) => {
    return `${value.toFixed(precision)} ${units}`;
  };
  
  // Determine if a measurement is within tolerances
  export const isMeasurementWithinTolerance = (value, nominal, lowerTolerance, upperTolerance) => {
    const lowerLimit = nominal - Math.abs(lowerTolerance);
    const upperLimit = nominal + Math.abs(upperTolerance);
    
    return value >= lowerLimit && value <= upperLimit;
  };
  
  // Generate a report string from measurement data
  export const generateMeasurementReport = (measurements, calibrationFactor, mode = 'width') => {
    if (!measurements || measurements.length === 0) {
      return "No measurements available";
    }
    
    // Convert to millimeters
    const millimeterMeasurements = measurements.map(m => pixelsToMillimeters(m, calibrationFactor));
    
    // Calculate statistics
    const pixelStats = calculateMeasurementStatistics(measurements);
    const mmStats = calculateMeasurementStatistics(millimeterMeasurements);
    
    // Generate report
    return `
  Measurement Report (${mode})
  ---------------------------
  Count: ${pixelStats.count}
  
  Pixel Measurements:
    Min: ${formatMeasurement(pixelStats.min, 'px')}
    Max: ${formatMeasurement(pixelStats.max, 'px')}
    Mean: ${formatMeasurement(pixelStats.mean, 'px')}
    Median: ${formatMeasurement(pixelStats.median, 'px')}
    Std Dev: ${formatMeasurement(pixelStats.stdDev, 'px')}
  
  Millimeter Measurements:
    Min: ${formatMeasurement(mmStats.min, 'mm')}
    Max: ${formatMeasurement(mmStats.max, 'mm')}
    Mean: ${formatMeasurement(mmStats.mean, 'mm')}
    Median: ${formatMeasurement(mmStats.median, 'mm')}
    Std Dev: ${formatMeasurement(mmStats.stdDev, 'mm')}
  
  Calibration: ${formatMeasurement(calibrationFactor, 'mm/px', 6)}
    `;
  };
  
  // Export measurement data as CSV
  export const exportMeasurementsAsCSV = (measurements, calibrationFactor, mode = 'width') => {
    if (!measurements || measurements.length === 0) {
      return "No data,No data";
    }
    
    // Headers
    let csv = `Measurement (${mode}),Pixels,Millimeters\n`;
    
    // Add each measurement
    measurements.forEach((measurement, index) => {
      const mmValue = pixelsToMillimeters(measurement, calibrationFactor);
      csv += `${index + 1},${measurement.toFixed(3)},${mmValue.toFixed(3)}\n`;
    });
    
    return csv;
  };