import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'

class ValidationResult {
	data: any
	error: any
}

/**
 * Validates and converts the given object to the specified class. Uses the class-validator decorators to ensure all params adhere to those specifications.
 * @param {any} classToConvert - The class to convert the object to.
 * @param {any} body - The object to validate and convert.
 * @return {Promise<ValidationResult>} A promise that resolves to a ValidationResult object containing the converted data and any validation errors.
 */
export const validateAndConvert = async (classToConvert: any, body: any) => {
	const result = new ValidationResult()
	result.data = plainToInstance(classToConvert, body)
	await validate(result.data, { skipMissingProperties: true }).then(errors => {
		// errors is an array of validation errors
		if (errors.length > 0) {
			let errorTexts = []
			for (const errorItem of errors) {
				errorTexts = errorTexts.concat(errorItem.constraints)
			}
			result.error = errorTexts
			return result
		}
	})
	return result
}
