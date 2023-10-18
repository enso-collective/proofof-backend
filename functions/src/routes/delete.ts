import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

import {
	COLLECTION_BOARDS,
	COLLECTION_POST_LOCATIONS,
	COLLECTION_POSTS,
	COLLECTION_USERS,
} from '../constants'
import { handleServerError } from '../utils/handleServerError'

export const deletePostFromBoards = functions.firestore
	.document(`${COLLECTION_POSTS}/{postId}`)
	.onDelete(async (snap, context) => {
		const postId = context.params.postId
		const userId = snap.data()?.ownerId
		const batch = admin.firestore().batch()

		const postLocationRef = admin.firestore().collection(COLLECTION_POST_LOCATIONS).doc(postId)

		const postLocationDoc = await postLocationRef.get()
		const postLocationsDocData = postLocationDoc.data()

		if (!postLocationsDocData?.locations) {
			return
		}

		const updatedPublicBoards = [...postLocationsDocData.locations.publicBoards]
		const updatedPrivateBoards = [...postLocationsDocData.locations.privateBoards]

		// Function to delete a post from a board and update the lists
		const deletePostFromBoard = (boardId: string, isPrivate: boolean) => {
			const collectionPath = isPrivate
				? `${COLLECTION_USERS}/${userId}/${COLLECTION_BOARDS}`
				: COLLECTION_BOARDS

			const postRef = admin
				.firestore()
				.collection(collectionPath)
				.doc(boardId)
				.collection('posts')
				.doc(postId)

			const index = isPrivate
				? updatedPrivateBoards.indexOf(boardId)
				: updatedPublicBoards.indexOf(boardId)

			if (index > -1) {
				isPrivate ? updatedPrivateBoards.splice(index, 1) : updatedPublicBoards.splice(index, 1)
			}

			batch.delete(postRef)
		}

		postLocationsDocData.locations.publicBoards.forEach((boardId: string) => {
			deletePostFromBoard(boardId, false)
		})

		postLocationsDocData.locations.privateBoards.forEach((boardId: string) => {
			deletePostFromBoard(boardId, true)
		})

		batch.update(postLocationRef, {
			'locations.publicBoards': updatedPublicBoards,
			'locations.privateBoards': updatedPrivateBoards,
		})

		return batch.commit().catch(error => {
			handleServerError(error)
			return null
		})
	})
