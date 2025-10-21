/**
 * Comprehensive Object Validation Service with Detailed Error Messages
 */

// import { CanvasObject } from '../types' // Unused import

export interface ValidationRule {
  name: string
  validate: (object: any) => ValidationResult
  severity: 'error' | 'warning' | 'info'
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  info: ValidationInfo[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
  value?: any
  expected?: any
}

export interface ValidationWarning {
  field: string
  message: string
  code: string
  value?: any
  suggestion?: string
}

export interface ValidationInfo {
  field: string
  message: string
  code: string
  value?: any
}

export interface ObjectConstraints {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight: number
  maxTextLength: number
  maxPoints: number
}

export interface ObjectTypeDefinition {
  name: string
  displayName: string
  description: string
  requiredProperties: string[]
  optionalProperties: string[]
  propertyConstraints: Map<string, PropertyConstraint>
  validationRules: string[]
  category: 'shape' | 'text' | 'drawing' | 'media' | 'container'
  isComposite: boolean
  supportsChildren: boolean
  maxChildren?: number
}

export interface PropertyConstraint {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'color' | 'point' | 'path'
  required: boolean
  min?: number
  max?: number
  pattern?: string
  enum?: any[]
  defaultValue?: any
  description: string
}

class ObjectValidationService {
  private constraints: ObjectConstraints = {
    minX: -10000,
    maxX: 10000,
    minY: -10000,
    maxY: 10000,
    minWidth: 1,
    maxWidth: 5000,
    minHeight: 1,
    maxHeight: 5000,
    maxTextLength: 1000,
    maxPoints: 100
  }

  private validObjectTypes = [
    'rectangle',
    'circle',
    'text',
    'heart',
    'star',
    'diamond',
    'line',
    'arrow',
    'polygon',
    'ellipse',
    'path',
    'image',
    'group',
    'freehand'
  ]

  private objectTypeDefinitions: Map<string, ObjectTypeDefinition> = new Map()

  private validationRules: ValidationRule[] = []

  constructor() {
    this.initializeObjectTypeDefinitions()
    this.initializeValidationRules()
  }

  /**
   * Initialize object type definitions
   */
  private initializeObjectTypeDefinitions(): void {
    // Rectangle definition
    this.objectTypeDefinitions.set('rectangle', {
      name: 'rectangle',
      displayName: 'Rectangle',
      description: 'A rectangular shape with width and height',
      requiredProperties: ['x', 'y', 'width', 'height'],
      optionalProperties: ['fill', 'stroke', 'strokeWidth', 'opacity', 'rotation', 'zIndex'],
      propertyConstraints: new Map([
        ['x', { type: 'number', required: true, description: 'X coordinate of the rectangle' }],
        ['y', { type: 'number', required: true, description: 'Y coordinate of the rectangle' }],
        ['width', { type: 'number', required: true, min: 1, description: 'Width of the rectangle' }],
        ['height', { type: 'number', required: true, min: 1, description: 'Height of the rectangle' }],
        ['fill', { type: 'color', required: false, defaultValue: '#000000', description: 'Fill color' }],
        ['stroke', { type: 'color', required: false, defaultValue: 'transparent', description: 'Stroke color' }],
        ['strokeWidth', { type: 'number', required: false, min: 0, defaultValue: 1, description: 'Stroke width' }],
        ['opacity', { type: 'number', required: false, min: 0, max: 1, defaultValue: 1, description: 'Opacity' }],
        ['rotation', { type: 'number', required: false, defaultValue: 0, description: 'Rotation in degrees' }],
        ['zIndex', { type: 'number', required: false, defaultValue: 0, description: 'Z-index for layering' }]
      ]),
      validationRules: ['position_bounds', 'size_positive', 'color_valid'],
      category: 'shape',
      isComposite: false,
      supportsChildren: false
    })

    // Circle definition
    this.objectTypeDefinitions.set('circle', {
      name: 'circle',
      displayName: 'Circle',
      description: 'A circular shape with radius',
      requiredProperties: ['x', 'y', 'radius'],
      optionalProperties: ['fill', 'stroke', 'strokeWidth', 'opacity', 'rotation', 'zIndex'],
      propertyConstraints: new Map([
        ['x', { type: 'number', required: true, description: 'X coordinate of the center' }],
        ['y', { type: 'number', required: true, description: 'Y coordinate of the center' }],
        ['radius', { type: 'number', required: true, min: 1, description: 'Radius of the circle' }],
        ['fill', { type: 'color', required: false, defaultValue: '#000000', description: 'Fill color' }],
        ['stroke', { type: 'color', required: false, defaultValue: 'transparent', description: 'Stroke color' }],
        ['strokeWidth', { type: 'number', required: false, min: 0, defaultValue: 1, description: 'Stroke width' }],
        ['opacity', { type: 'number', required: false, min: 0, max: 1, defaultValue: 1, description: 'Opacity' }],
        ['rotation', { type: 'number', required: false, defaultValue: 0, description: 'Rotation in degrees' }],
        ['zIndex', { type: 'number', required: false, defaultValue: 0, description: 'Z-index for layering' }]
      ]),
      validationRules: ['position_bounds', 'radius_positive', 'color_valid'],
      category: 'shape',
      isComposite: false,
      supportsChildren: false
    })

    // Text definition
    this.objectTypeDefinitions.set('text', {
      name: 'text',
      displayName: 'Text',
      description: 'A text object with content and styling',
      requiredProperties: ['x', 'y', 'text', 'fontSize'],
      optionalProperties: ['fontFamily', 'fontWeight', 'color', 'opacity', 'rotation', 'zIndex', 'textAlign', 'maxWidth'],
      propertyConstraints: new Map([
        ['x', { type: 'number', required: true, description: 'X coordinate of the text' }],
        ['y', { type: 'number', required: true, description: 'Y coordinate of the text' }],
        ['text', { type: 'string', required: true, description: 'Text content' }],
        ['fontSize', { type: 'number', required: true, min: 1, max: 200, description: 'Font size in pixels' }],
        ['fontFamily', { type: 'string', required: false, defaultValue: 'Arial', description: 'Font family' }],
        ['fontWeight', { type: 'string', required: false, enum: ['normal', 'bold', 'lighter', 'bolder'], defaultValue: 'normal', description: 'Font weight' }],
        ['color', { type: 'color', required: false, defaultValue: '#000000', description: 'Text color' }],
        ['opacity', { type: 'number', required: false, min: 0, max: 1, defaultValue: 1, description: 'Opacity' }],
        ['rotation', { type: 'number', required: false, defaultValue: 0, description: 'Rotation in degrees' }],
        ['zIndex', { type: 'number', required: false, defaultValue: 0, description: 'Z-index for layering' }],
        ['textAlign', { type: 'string', required: false, enum: ['left', 'center', 'right'], defaultValue: 'left', description: 'Text alignment' }],
        ['maxWidth', { type: 'number', required: false, min: 1, description: 'Maximum width for text wrapping' }]
      ]),
      validationRules: ['position_bounds', 'text_content', 'font_size_valid', 'color_valid'],
      category: 'text',
      isComposite: false,
      supportsChildren: false
    })

    // Line definition
    this.objectTypeDefinitions.set('line', {
      name: 'line',
      displayName: 'Line',
      description: 'A straight line between two points',
      requiredProperties: ['points'],
      optionalProperties: ['stroke', 'strokeWidth', 'opacity', 'zIndex'],
      propertyConstraints: new Map([
        ['points', { type: 'array', required: true, description: 'Array of coordinates [x1, y1, x2, y2]' }],
        ['stroke', { type: 'color', required: false, defaultValue: '#000000', description: 'Line color' }],
        ['strokeWidth', { type: 'number', required: false, min: 1, defaultValue: 2, description: 'Line width' }],
        ['opacity', { type: 'number', required: false, min: 0, max: 1, defaultValue: 1, description: 'Opacity' }],
        ['zIndex', { type: 'number', required: false, defaultValue: 0, description: 'Z-index for layering' }]
      ]),
      validationRules: ['position_bounds', 'line_points_valid', 'color_valid'],
      category: 'drawing',
      isComposite: false,
      supportsChildren: false
    })

    // Arrow definition
    this.objectTypeDefinitions.set('arrow', {
      name: 'arrow',
      displayName: 'Arrow',
      description: 'An arrow pointing from one point to another',
      requiredProperties: ['points'],
      optionalProperties: ['stroke', 'strokeWidth', 'opacity', 'zIndex', 'arrowSize'],
      propertyConstraints: new Map([
        ['points', { type: 'array', required: true, description: 'Array of coordinates [x1, y1, x2, y2]' }],
        ['stroke', { type: 'color', required: false, defaultValue: '#000000', description: 'Arrow color' }],
        ['strokeWidth', { type: 'number', required: false, min: 1, defaultValue: 2, description: 'Arrow width' }],
        ['opacity', { type: 'number', required: false, min: 0, max: 1, defaultValue: 1, description: 'Opacity' }],
        ['zIndex', { type: 'number', required: false, defaultValue: 0, description: 'Z-index for layering' }],
        ['arrowSize', { type: 'number', required: false, min: 1, max: 50, defaultValue: 10, description: 'Size of arrow head' }]
      ]),
      validationRules: ['position_bounds', 'line_points_valid', 'color_valid'],
      category: 'drawing',
      isComposite: false,
      supportsChildren: false
    })

    // Group definition
    this.objectTypeDefinitions.set('group', {
      name: 'group',
      displayName: 'Group',
      description: 'A container for multiple objects',
      requiredProperties: ['x', 'y'],
      optionalProperties: ['width', 'height', 'opacity', 'rotation', 'zIndex'],
      propertyConstraints: new Map([
        ['x', { type: 'number', required: true, description: 'X coordinate of the group' }],
        ['y', { type: 'number', required: true, description: 'Y coordinate of the group' }],
        ['width', { type: 'number', required: false, min: 0, description: 'Width of the group bounds' }],
        ['height', { type: 'number', required: false, min: 0, description: 'Height of the group bounds' }],
        ['opacity', { type: 'number', required: false, min: 0, max: 1, defaultValue: 1, description: 'Opacity' }],
        ['rotation', { type: 'number', required: false, defaultValue: 0, description: 'Rotation in degrees' }],
        ['zIndex', { type: 'number', required: false, defaultValue: 0, description: 'Z-index for layering' }]
      ]),
      validationRules: ['position_bounds', 'group_children_valid'],
      category: 'container',
      isComposite: true,
      supportsChildren: true,
      maxChildren: 100
    })

    // Freehand definition
    this.objectTypeDefinitions.set('freehand', {
      name: 'freehand',
      displayName: 'Freehand Drawing',
      description: 'A freehand drawing with multiple points',
      requiredProperties: ['points'],
      optionalProperties: ['stroke', 'strokeWidth', 'opacity', 'zIndex'],
      propertyConstraints: new Map([
        ['points', { type: 'array', required: true, description: 'Array of points for the freehand drawing' }],
        ['stroke', { type: 'color', required: false, defaultValue: '#000000', description: 'Drawing color' }],
        ['strokeWidth', { type: 'number', required: false, min: 1, defaultValue: 2, description: 'Drawing width' }],
        ['opacity', { type: 'number', required: false, min: 0, max: 1, defaultValue: 1, description: 'Opacity' }],
        ['zIndex', { type: 'number', required: false, defaultValue: 0, description: 'Z-index for layering' }]
      ]),
      validationRules: ['position_bounds', 'points_valid', 'color_valid'],
      category: 'drawing',
      isComposite: false,
      supportsChildren: false
    })
  }

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): void {
    this.validationRules = [
      // Basic object structure validation
      {
        name: 'object_exists',
        validate: (object) => this.validateObjectExists(object),
        severity: 'error',
        message: 'Object data is required'
      },
      {
        name: 'object_type_required',
        validate: (object) => this.validateObjectTypeRequired(object),
        severity: 'error',
        message: 'Object type is required'
      },
      {
        name: 'object_type_valid',
        validate: (object) => this.validateObjectTypeValid(object),
        severity: 'error',
        message: 'Invalid object type'
      },
      {
        name: 'properties_required',
        validate: (object) => this.validatePropertiesRequired(object),
        severity: 'error',
        message: 'Object properties are required'
      },

      // Position validation
      {
        name: 'position_required',
        validate: (object) => this.validatePositionRequired(object),
        severity: 'error',
        message: 'Position (x, y) is required'
      },
      {
        name: 'position_numeric',
        validate: (object) => this.validatePositionNumeric(object),
        severity: 'error',
        message: 'Position must be numeric'
      },
      {
        name: 'position_bounds',
        validate: (object) => this.validatePositionBounds(object),
        severity: 'warning',
        message: 'Position is outside recommended bounds'
      },

      // Size validation
      {
        name: 'size_required',
        validate: (object) => this.validateSizeRequired(object),
        severity: 'error',
        message: 'Size (width, height) is required'
      },
      {
        name: 'size_numeric',
        validate: (object) => this.validateSizeNumeric(object),
        severity: 'error',
        message: 'Size must be numeric'
      },
      {
        name: 'size_positive',
        validate: (object) => this.validateSizePositive(object),
        severity: 'error',
        message: 'Size must be positive'
      },
      {
        name: 'size_bounds',
        validate: (object) => this.validateSizeBounds(object),
        severity: 'warning',
        message: 'Size is outside recommended bounds'
      },

      // Text-specific validation
      {
        name: 'text_content_required',
        validate: (object) => this.validateTextContentRequired(object),
        severity: 'error',
        message: 'Text content is required for text objects'
      },
      {
        name: 'text_length',
        validate: (object) => this.validateTextLength(object),
        severity: 'warning',
        message: 'Text content is very long'
      },

      // Line/Arrow-specific validation
      {
        name: 'points_required',
        validate: (object) => this.validatePointsRequired(object),
        severity: 'error',
        message: 'Points array is required for line/arrow objects'
      },
      {
        name: 'points_format',
        validate: (object) => this.validatePointsFormat(object),
        severity: 'error',
        message: 'Points must be an array of numbers'
      },
      {
        name: 'points_count',
        validate: (object) => this.validatePointsCount(object),
        severity: 'error',
        message: 'Invalid number of points'
      },

      // Z-index validation
      {
        name: 'z_index_numeric',
        validate: (object) => this.validateZIndexNumeric(object),
        severity: 'error',
        message: 'Z-index must be numeric'
      },
      {
        name: 'z_index_bounds',
        validate: (object) => this.validateZIndexBounds(object),
        severity: 'warning',
        message: 'Z-index is outside recommended range'
      },

      // Color validation
      {
        name: 'color_format',
        validate: (object) => this.validateColorFormat(object),
        severity: 'warning',
        message: 'Invalid color format'
      },

      // Performance validation
      {
        name: 'performance_check',
        validate: (object) => this.validatePerformance(object),
        severity: 'info',
        message: 'Performance considerations'
      }
    ]
  }

  /**
   * Validate object with comprehensive rules
   */
  public validateObject(object: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      info: []
    }

    // Run all validation rules
    for (const rule of this.validationRules) {
      try {
        const ruleResult = rule.validate(object)
        
        if (!ruleResult.isValid) {
          result.isValid = false
        }

        result.errors.push(...ruleResult.errors)
        result.warnings.push(...ruleResult.warnings)
        result.info.push(...ruleResult.info)
      } catch (error) {
        console.error(`Validation rule ${rule.name} failed:`, error)
        result.errors.push({
          field: 'validation',
          message: `Validation rule failed: ${rule.name}`,
          code: 'VALIDATION_RULE_ERROR'
        })
        result.isValid = false
      }
    }

    return result
  }

  /**
   * Validate object exists
   */
  private validateObjectExists(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    if (!object || object === null || object === undefined) {
      result.isValid = false
      result.errors.push({
        field: 'object',
        message: 'Object data is required and cannot be null or undefined',
        code: 'OBJECT_REQUIRED'
      })
    }

    return result
  }

  /**
   * Validate object type is required
   */
  private validateObjectTypeRequired(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const objectType = object?.type || object?.object_type
    if (!objectType) {
      result.isValid = false
      result.errors.push({
        field: 'type',
        message: 'Object type is required. Use "type" or "object_type" field',
        code: 'TYPE_REQUIRED'
      })
    }

    return result
  }

  /**
   * Validate object type is valid
   */
  private validateObjectTypeValid(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const objectType = object?.type || object?.object_type
    if (objectType && !this.validObjectTypes.includes(objectType)) {
      result.isValid = false
      result.errors.push({
        field: 'type',
        message: `Invalid object type: ${objectType}. Valid types: ${this.validObjectTypes.join(', ')}`,
        code: 'INVALID_TYPE',
        value: objectType,
        expected: this.validObjectTypes
      })
    }

    return result
  }

  /**
   * Validate properties are required
   */
  private validatePropertiesRequired(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const properties = object?.properties || object
    if (!properties || typeof properties !== 'object') {
      result.isValid = false
      result.errors.push({
        field: 'properties',
        message: 'Object properties are required and must be an object',
        code: 'PROPERTIES_REQUIRED'
      })
    }

    return result
  }

  /**
   * Validate position is required
   */
  private validatePositionRequired(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const objectType = object?.type || object?.object_type
    const properties = object?.properties || object
    
    if (['rectangle', 'circle', 'text', 'heart', 'star', 'diamond'].includes(objectType)) {
      if (properties?.x === undefined || properties?.y === undefined) {
        result.isValid = false
        result.errors.push({
          field: 'position',
          message: `Position (x, y) is required for ${objectType} objects`,
          code: 'POSITION_REQUIRED'
        })
      }
    }

    return result
  }

  /**
   * Validate position is numeric
   */
  private validatePositionNumeric(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const properties = object?.properties || object
    
    if (properties?.x !== undefined && typeof properties.x !== 'number') {
      result.isValid = false
      result.errors.push({
        field: 'x',
        message: 'X position must be a number',
        code: 'POSITION_NUMERIC',
        value: properties.x,
        expected: 'number'
      })
    }
    
    if (properties?.y !== undefined && typeof properties.y !== 'number') {
      result.isValid = false
      result.errors.push({
        field: 'y',
        message: 'Y position must be a number',
        code: 'POSITION_NUMERIC',
        value: properties.y,
        expected: 'number'
      })
    }

    return result
  }

  /**
   * Validate position bounds
   */
  private validatePositionBounds(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const properties = object?.properties || object
    
    if (properties?.x !== undefined) {
      if (properties.x < this.constraints.minX || properties.x > this.constraints.maxX) {
        result.warnings.push({
          field: 'x',
          message: `X position (${properties.x}) is outside recommended bounds (${this.constraints.minX} to ${this.constraints.maxX})`,
          code: 'POSITION_BOUNDS',
          value: properties.x,
          suggestion: `Consider using a value between ${this.constraints.minX} and ${this.constraints.maxX}`
        })
      }
    }
    
    if (properties?.y !== undefined) {
      if (properties.y < this.constraints.minY || properties.y > this.constraints.maxY) {
        result.warnings.push({
          field: 'y',
          message: `Y position (${properties.y}) is outside recommended bounds (${this.constraints.minY} to ${this.constraints.maxY})`,
          code: 'POSITION_BOUNDS',
          value: properties.y,
          suggestion: `Consider using a value between ${this.constraints.minY} and ${this.constraints.maxY}`
        })
      }
    }

    return result
  }

  /**
   * Validate size is required
   */
  private validateSizeRequired(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const objectType = object?.type || object?.object_type
    const properties = object?.properties || object
    
    if (['rectangle', 'circle', 'heart', 'star', 'diamond'].includes(objectType)) {
      if (properties?.width === undefined || properties?.height === undefined) {
        result.isValid = false
        result.errors.push({
          field: 'size',
          message: `Size (width, height) is required for ${objectType} objects`,
          code: 'SIZE_REQUIRED'
        })
      }
    }

    return result
  }

  /**
   * Validate size is numeric
   */
  private validateSizeNumeric(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const properties = object?.properties || object
    
    if (properties?.width !== undefined && typeof properties.width !== 'number') {
      result.isValid = false
      result.errors.push({
        field: 'width',
        message: 'Width must be a number',
        code: 'SIZE_NUMERIC',
        value: properties.width,
        expected: 'number'
      })
    }
    
    if (properties?.height !== undefined && typeof properties.height !== 'number') {
      result.isValid = false
      result.errors.push({
        field: 'height',
        message: 'Height must be a number',
        code: 'SIZE_NUMERIC',
        value: properties.height,
        expected: 'number'
      })
    }

    return result
  }

  /**
   * Validate size is positive
   */
  private validateSizePositive(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const properties = object?.properties || object
    
    if (properties?.width !== undefined && properties.width <= 0) {
      result.isValid = false
      result.errors.push({
        field: 'width',
        message: 'Width must be a positive number',
        code: 'SIZE_POSITIVE',
        value: properties.width
      })
    }
    
    if (properties?.height !== undefined && properties.height <= 0) {
      result.isValid = false
      result.errors.push({
        field: 'height',
        message: 'Height must be a positive number',
        code: 'SIZE_POSITIVE',
        value: properties.height
      })
    }

    return result
  }

  /**
   * Validate size bounds
   */
  private validateSizeBounds(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const properties = object?.properties || object
    
    if (properties?.width !== undefined) {
      if (properties.width < this.constraints.minWidth || properties.width > this.constraints.maxWidth) {
        result.warnings.push({
          field: 'width',
          message: `Width (${properties.width}) is outside recommended bounds (${this.constraints.minWidth} to ${this.constraints.maxWidth})`,
          code: 'SIZE_BOUNDS',
          value: properties.width,
          suggestion: `Consider using a value between ${this.constraints.minWidth} and ${this.constraints.maxWidth}`
        })
      }
    }
    
    if (properties?.height !== undefined) {
      if (properties.height < this.constraints.minHeight || properties.height > this.constraints.maxHeight) {
        result.warnings.push({
          field: 'height',
          message: `Height (${properties.height}) is outside recommended bounds (${this.constraints.minHeight} to ${this.constraints.maxHeight})`,
          code: 'SIZE_BOUNDS',
          value: properties.height,
          suggestion: `Consider using a value between ${this.constraints.minHeight} and ${this.constraints.maxHeight}`
        })
      }
    }

    return result
  }

  /**
   * Validate text content is required
   */
  private validateTextContentRequired(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const objectType = object?.type || object?.object_type
    const properties = object?.properties || object
    
    if (objectType === 'text') {
      if (!properties?.text || typeof properties.text !== 'string') {
        result.isValid = false
        result.errors.push({
          field: 'text',
          message: 'Text content is required for text objects',
          code: 'TEXT_REQUIRED'
        })
      }
    }

    return result
  }

  /**
   * Validate text length
   */
  private validateTextLength(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const objectType = object?.type || object?.object_type
    const properties = object?.properties || object
    
    if (objectType === 'text' && properties?.text) {
      if (properties.text.length > this.constraints.maxTextLength) {
        result.warnings.push({
          field: 'text',
          message: `Text content is very long (${properties.text.length} characters). Maximum recommended: ${this.constraints.maxTextLength}`,
          code: 'TEXT_LENGTH',
          value: properties.text.length,
          suggestion: 'Consider breaking long text into multiple objects'
        })
      }
    }

    return result
  }

  /**
   * Validate points are required
   */
  private validatePointsRequired(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const objectType = object?.type || object?.object_type
    const properties = object?.properties || object
    
    if (['line', 'arrow'].includes(objectType)) {
      if (!properties?.points) {
        result.isValid = false
        result.errors.push({
          field: 'points',
          message: `Points array is required for ${objectType} objects`,
          code: 'POINTS_REQUIRED'
        })
      }
    }

    return result
  }

  /**
   * Validate points format
   */
  private validatePointsFormat(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const properties = object?.properties || object
    
    if (properties?.points) {
      if (!Array.isArray(properties.points)) {
        result.isValid = false
        result.errors.push({
          field: 'points',
          message: 'Points must be an array',
          code: 'POINTS_FORMAT',
          value: properties.points,
          expected: 'array'
        })
      } else {
        const nonNumericPoints = properties.points.filter((point: any) => typeof point !== 'number')
        if (nonNumericPoints.length > 0) {
          result.isValid = false
          result.errors.push({
            field: 'points',
            message: 'All points must be numbers',
            code: 'POINTS_FORMAT',
            value: nonNumericPoints
          })
        }
      }
    }

    return result
  }

  /**
   * Validate points count
   */
  private validatePointsCount(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const objectType = object?.type || object?.object_type
    const properties = object?.properties || object
    
    if (['line', 'arrow'].includes(objectType) && Array.isArray(properties?.points)) {
      const pointCount = properties.points.length
      
      if (pointCount < 4) {
        result.isValid = false
        result.errors.push({
          field: 'points',
          message: `Line/arrow requires at least 4 points (x1, y1, x2, y2), got ${pointCount}`,
          code: 'POINTS_COUNT',
          value: pointCount,
          expected: '>= 4'
        })
      } else if (pointCount % 2 !== 0) {
        result.isValid = false
        result.errors.push({
          field: 'points',
          message: `Points array must have an even number of elements (pairs of x, y coordinates), got ${pointCount}`,
          code: 'POINTS_COUNT',
          value: pointCount,
          expected: 'even number'
        })
      } else if (pointCount > this.constraints.maxPoints) {
        result.warnings.push({
          field: 'points',
          message: `Points array is very large (${pointCount} points). Maximum recommended: ${this.constraints.maxPoints}`,
          code: 'POINTS_COUNT',
          value: pointCount,
          suggestion: 'Consider simplifying the line/arrow'
        })
      }
    }

    return result
  }

  /**
   * Validate z-index is numeric
   */
  private validateZIndexNumeric(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const properties = object?.properties || object
    
    if (properties?.z_index !== undefined && typeof properties.z_index !== 'number') {
      result.isValid = false
      result.errors.push({
        field: 'z_index',
        message: 'Z-index must be a number',
        code: 'Z_INDEX_NUMERIC',
        value: properties.z_index,
        expected: 'number'
      })
    }

    return result
  }

  /**
   * Validate z-index bounds
   */
  private validateZIndexBounds(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const properties = object?.properties || object
    
    if (properties?.z_index !== undefined) {
      if (properties.z_index < -1000 || properties.z_index > 1000) {
        result.warnings.push({
          field: 'z_index',
          message: `Z-index (${properties.z_index}) is outside recommended range (-1000 to 1000)`,
          code: 'Z_INDEX_BOUNDS',
          value: properties.z_index,
          suggestion: 'Consider using a value between -1000 and 1000'
        })
      }
    }

    return result
  }

  /**
   * Validate color format
   */
  private validateColorFormat(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const properties = object?.properties || object
    const colorFields = ['fill', 'stroke', 'backgroundColor', 'textColor']
    
    for (const field of colorFields) {
      if (properties?.[field] !== undefined) {
        const color = properties[field]
        if (typeof color === 'string') {
          // Basic color format validation
          const isValidColor = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color) ||
                              /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color) ||
                              /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/.test(color) ||
                              ['transparent', 'none'].includes(color.toLowerCase())
          
          if (!isValidColor) {
            result.warnings.push({
              field: field,
              message: `Invalid color format: ${color}. Use hex (#RRGGBB), rgb(), rgba(), or named colors`,
              code: 'COLOR_FORMAT',
              value: color,
              suggestion: 'Use a valid CSS color value'
            })
          }
        }
      }
    }

    return result
  }

  /**
   * Validate performance considerations
   */
  private validatePerformance(object: any): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [], info: [] }
    
    const properties = object?.properties || object
    const objectType = object?.type || object?.object_type
    
    // Check for performance-impacting properties
    if (properties?.width && properties?.height) {
      const area = properties.width * properties.height
      if (area > 1000000) { // 1 million pixels
        result.info.push({
          field: 'size',
          message: `Large object area (${area.toLocaleString()} pixels) may impact performance`,
          code: 'PERFORMANCE_LARGE_AREA',
          value: area
        })
      }
    }
    
    if (objectType === 'text' && properties?.text && properties.text.length > 500) {
      result.info.push({
        field: 'text',
        message: `Long text content (${properties.text.length} characters) may impact rendering performance`,
        code: 'PERFORMANCE_LONG_TEXT',
        value: properties.text.length
      })
    }

    return result
  }

  /**
   * Get validation constraints
   */
  public getConstraints(): ObjectConstraints {
    return { ...this.constraints }
  }

  /**
   * Get object type definition
   */
  public getObjectTypeDefinition(objectType: string): ObjectTypeDefinition | null {
    return this.objectTypeDefinitions.get(objectType) || null
  }

  /**
   * Get all object type definitions
   */
  public getAllObjectTypeDefinitions(): Map<string, ObjectTypeDefinition> {
    return new Map(this.objectTypeDefinitions)
  }

  /**
   * Get valid object types
   */
  public getValidObjectTypes(): string[] {
    return [...this.validObjectTypes]
  }

  /**
   * Check if object type is valid
   */
  public isValidObjectType(objectType: string): boolean {
    return this.validObjectTypes.includes(objectType)
  }

  /**
   * Get object types by category
   */
  public getObjectTypesByCategory(category: string): string[] {
    return Array.from(this.objectTypeDefinitions.entries())
      .filter(([_, definition]) => definition.category === category)
      .map(([name, _]) => name)
  }

  /**
   * Validate object type and properties against definition
   */
  public validateObjectTypeAndProperties(object: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      info: []
    }

    // Get object type
    const objectType = object.type || object.object_type
    if (!objectType) {
      result.errors.push({
        field: 'type',
        message: 'Object type is required',
        code: 'MISSING_TYPE'
      })
      result.isValid = false
      return result
    }

    // Check if object type is valid
    if (!this.isValidObjectType(objectType)) {
      result.errors.push({
        field: 'type',
        message: `Invalid object type: ${objectType}`,
        code: 'INVALID_TYPE',
        value: objectType,
        expected: this.validObjectTypes
      })
      result.isValid = false
      return result
    }

    // Get object type definition
    const definition = this.getObjectTypeDefinition(objectType)
    if (!definition) {
      result.errors.push({
        field: 'type',
        message: `Object type definition not found: ${objectType}`,
        code: 'MISSING_DEFINITION',
        value: objectType
      })
      result.isValid = false
      return result
    }

    // Validate required properties
    for (const requiredProp of definition.requiredProperties) {
      if (!(requiredProp in object) && !(requiredProp in (object.properties || {}))) {
        result.errors.push({
          field: requiredProp,
          message: `Required property '${requiredProp}' is missing`,
          code: 'MISSING_REQUIRED_PROPERTY',
          expected: definition.propertyConstraints.get(requiredProp)?.type
        })
        result.isValid = false
      }
    }

    // Validate property constraints
    const properties = object.properties || object
    for (const [propName, constraint] of definition.propertyConstraints) {
      const value = properties[propName]
      
      if (value !== undefined) {
        const propValidation = this.validatePropertyValue(propName, value, constraint)
        if (!propValidation.isValid) {
          result.errors.push(...propValidation.errors)
          result.warnings.push(...propValidation.warnings)
          result.info.push(...propValidation.info)
          if (propValidation.errors.length > 0) {
            result.isValid = false
          }
        }
      } else if (constraint.required) {
        result.errors.push({
          field: propName,
          message: `Required property '${propName}' is missing`,
          code: 'MISSING_REQUIRED_PROPERTY'
        })
        result.isValid = false
      }
    }

    return result
  }

  /**
   * Validate property value against constraint
   */
  private validatePropertyValue(propName: string, value: any, constraint: PropertyConstraint): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      info: []
    }

    // Type validation
    if (!this.validatePropertyType(value, constraint.type)) {
      result.errors.push({
        field: propName,
        message: `Property '${propName}' must be of type ${constraint.type}`,
        code: 'INVALID_TYPE',
        value,
        expected: constraint.type
      })
      result.isValid = false
      return result
    }

    // Range validation for numbers
    if (constraint.type === 'number' && typeof value === 'number') {
      if (constraint.min !== undefined && value < constraint.min) {
        result.errors.push({
          field: propName,
          message: `Property '${propName}' must be at least ${constraint.min}`,
          code: 'VALUE_TOO_SMALL',
          value,
          expected: constraint.min
        })
        result.isValid = false
      }
      
      if (constraint.max !== undefined && value > constraint.max) {
        result.errors.push({
          field: propName,
          message: `Property '${propName}' must be at most ${constraint.max}`,
          code: 'VALUE_TOO_LARGE',
          value,
          expected: constraint.max
        })
        result.isValid = false
      }
    }

    // Enum validation
    if (constraint.enum && !constraint.enum.includes(value)) {
      result.errors.push({
        field: propName,
        message: `Property '${propName}' must be one of: ${constraint.enum.join(', ')}`,
        code: 'INVALID_ENUM_VALUE',
        value,
        expected: constraint.enum
      })
      result.isValid = false
    }

    // Pattern validation for strings
    if (constraint.type === 'string' && constraint.pattern && typeof value === 'string') {
      const regex = new RegExp(constraint.pattern)
      if (!regex.test(value)) {
        result.errors.push({
          field: propName,
          message: `Property '${propName}' does not match required pattern`,
          code: 'PATTERN_MISMATCH',
          value,
          expected: constraint.pattern
        })
        result.isValid = false
      }
    }

    return result
  }

  /**
   * Validate property type
   */
  private validatePropertyType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !isNaN(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      case 'color':
        return typeof value === 'string' && this.isValidColor(value)
      case 'point':
        return Array.isArray(value) && value.length === 2 && 
               typeof value[0] === 'number' && typeof value[1] === 'number'
      case 'path':
        return Array.isArray(value) && value.every(point => 
          Array.isArray(point) && point.length === 2 &&
          typeof point[0] === 'number' && typeof point[1] === 'number'
        )
      default:
        return true
    }
  }

  /**
   * Validate color value
   */
  private isValidColor(color: string): boolean {
    // Basic color validation - hex, rgb, rgba, named colors
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    const rgbPattern = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/
    const rgbaPattern = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/
    const namedColors = ['transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey']
    
    return hexPattern.test(color) || 
           rgbPattern.test(color) || 
           rgbaPattern.test(color) || 
           namedColors.includes(color.toLowerCase())
  }

  /**
   * Update validation constraints
   */
  public updateConstraints(constraints: Partial<ObjectConstraints>): void {
    this.constraints = { ...this.constraints, ...constraints }
  }

  /**
   * Add custom validation rule
   */
  public addValidationRule(rule: ValidationRule): void {
    this.validationRules.push(rule)
  }

  /**
   * Remove validation rule
   */
  public removeValidationRule(ruleName: string): void {
    this.validationRules = this.validationRules.filter(rule => rule.name !== ruleName)
  }
}

// Export singleton instance
export const objectValidationService = new ObjectValidationService()

// Export service
export { ObjectValidationService }
