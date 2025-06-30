/**
 * Code Quality Fixer Module for SourceBottle Extension
 * Helps identify and fix common syntax errors and linting issues
 */

class CodeQualityFixer {
  constructor() {
    this.fixedFiles = [];
  }

  /**
   * Fix common JavaScript syntax issues
   * @param {string} code - The JavaScript code to fix
   * @returns {string} - The fixed code
   */
  fixJavaScriptSyntax(code) {
    if (!code) return '';
    
    // Fix missing semicolons
    code = this.fixMissingSemicolons(code);
    
    // Fix unbalanced brackets and braces
    code = this.fixUnbalancedBrackets(code);
    
    // Fix improper class definitions
    code = this.fixClassDefinitions(code);
    
    return code;
  }
  
  /**
   * Fix missing semicolons in JavaScript code
   * @param {string} code - Code to fix
   * @returns {string} - Fixed code
   */
  fixMissingSemicolons(code) {
    // Add semicolons after statements that should have them
    return code.replace(/(\w+)\s*\n/g, '$1;\n');
  }
  
  /**
   * Fix unbalanced brackets and braces
   * @param {string} code - Code to fix
   * @returns {string} - Fixed code
   */
  fixUnbalancedBrackets(code) {
    // Count opening and closing brackets and braces
    const counts = {
      '{': 0,
      '}': 0,
      '[': 0,
      ']': 0,
      '(': 0,
      ')': 0
    };
    
    // Count all brackets
    for (const char of code) {
      if (counts[char] !== undefined) {
        counts[char]++;
      }
    }
    
    // Fix imbalances
    let fixedCode = code;
    if (counts['{'] > counts['}']) {
      // Add missing closing braces
      const missing = counts['{'] - counts['}'];
      fixedCode += '\n' + '}'.repeat(missing);
    }
    
    if (counts['['] > counts[']']) {
      // Add missing closing brackets
      const missing = counts['['] - counts[']'];
      fixedCode += '\n' + ']'.repeat(missing);
    }
    
    if (counts['('] > counts[')']) {
      // Add missing closing parentheses
      const missing = counts['('] - counts[')'];
      fixedCode += '\n' + ')'.repeat(missing);
    }
    
    return fixedCode;
  }
  
  /**
   * Fix improper class definitions
   * @param {string} code - Code to fix
   * @returns {string} - Fixed code
   */
  fixClassDefinitions(code) {
    // Fix class property assignments outside of methods
    return code.replace(/class\s+(\w+)\s*\{([^{}]*?)(\w+)\s*:\s*([^;]+)(?!\s*[,{])/g, 
      (match, className, beforeProp, propName, propValue) => {
        return `class ${className} {${beforeProp}  constructor() {\n    this.${propName} = ${propValue};\n  }\n`;
      }
    );
  }
}

// Export a singleton instance
const codeQualityFixer = new CodeQualityFixer();
export default codeQualityFixer;
