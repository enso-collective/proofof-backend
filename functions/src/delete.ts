import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';



export const deletePostFromBoards = functions.firestore
  .document('posts/{postId}')
  .onDelete(async (snap, context) => {
    const postId = context.params.postId;
    const userId = snap.data()?.ownerId;
    const batch = admin.firestore().batch();

    const postLocationRef = admin
      .firestore()
      .collection('postLocations')
      .doc(postId);

    const postLocationDoc = await postLocationRef.get();
    const postLocationsDocData = postLocationDoc.data();

    if (!postLocationsDocData?.locations) {
      return;
    }

    const updatedPublicBoards = [
      ...postLocationsDocData.locations.publicBoards,
    ];
    const updatedPrivateBoards = [
      ...postLocationsDocData.locations.privateBoards,
    ];

    postLocationsDocData.locations.publicBoards.forEach((boardId: string) => {
      const postRef = admin
        .firestore()
        .collection('boards')
        .doc(boardId)
        .collection('posts')
        .doc(postId);
      const index = updatedPublicBoards.indexOf(boardId);
      if (index > -1) {
        updatedPublicBoards.splice(index, 1);
      }
      batch.delete(postRef);
    });

    postLocationsDocData.locations.privateBoards.forEach((boardId: string) => {
      const postRef = admin
        .firestore()
        .collection('users')
        .doc(userId)
        .collection('boards')
        .doc(boardId)
        .collection('posts')
        .doc(postId);
      const index = updatedPrivateBoards.indexOf(boardId);
      if (index > -1) {
        updatedPrivateBoards.splice(index, 1);
      }
      batch.delete(postRef);
    });

    batch.update(postLocationRef, {
      'locations.publicBoards': updatedPublicBoards,
      'locations.privateBoards': updatedPrivateBoards,
    });

    return batch.commit();
  });
