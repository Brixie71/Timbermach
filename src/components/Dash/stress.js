export function calcExperimentalStress({ dataType, row }) {
    const P =
      parseFloat(row.max_force || row["Maximum Force"] || row.maximum_force) || 0;
  
    const A = parseFloat(row.area) || 0;
    const b = parseFloat(row.base) || 0;
    const h = parseFloat(row.height) || 0;
  
    // IMPORTANT: for flexure this must be SPAN, not "wood length"
    // If you don't store span, set it as a constant (example: 800mm).
    const span = parseFloat(row.span_mm) || parseFloat(row.length) || 800;
  
    if (dataType === "compressive") {
      return A > 0 ? P / A : 0;
    }
  
    if (dataType === "shear") {
      const isDouble = String(row.test_type || "").toLowerCase().includes("double");
      return A > 0 ? (isDouble ? P / (2 * A) : P / A) : 0;
    }
  
    if (dataType === "flexure") {
      // Spreadsheet equation: σ = (3 P L) / (2 b h^2)
      if (!b || !h || !span) return 0;
      return (3 * P * span) / (2 * b * h * h);
    }
  
    return 0;
  }
  