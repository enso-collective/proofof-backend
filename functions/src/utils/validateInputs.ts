import { ClassConstructor, plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

class ValidationResult<T> {
	data: T
	error?: string[]
}

/**
 * Validates and converts the given object to the specified class. Uses the class-validator decorators to ensure all params adhere to those specifications.
 * @param {T} classToConvert - Typically one of the DTO and of that type
 * @param {U} body - The payload object to validate against the T class-validation decorators
 * @return {Promise<ValidationResult<T>>} A promise that resolves to a ValidationResult object containing the converted data and any validation errors.
 */
export const validateAndConvert = async <T, U>(
	classToConvert: ClassConstructor<T>,
	body: U,
): Promise<ValidationResult<T>> => {
	const result = new ValidationResult<T>()
	result.data = plainToInstance(classToConvert, body)

	// If there are errors, simplify and flatten them
	const errors = await validate(result.data as object, { skipMissingProperties: true })
	if (errors.length) {
		result.error = errors.flatMap(errorItem => Object.values(errorItem.constraints))
	}

	return result
}
