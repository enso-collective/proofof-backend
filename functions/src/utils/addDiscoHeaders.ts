import { NextFunction, Request, Response } from 'express'

const addDiscoHeaders = (req: Request, res: Response, next: NextFunction) => {
	req.headers['Content-Type'] = 'application/json'
	req.headers['Accept'] = '*/*'
	req.headers['Authorization'] = `Bearer ${process.env.DISCO_API_KEY}`
	next()
}

export default addDiscoHeaders
