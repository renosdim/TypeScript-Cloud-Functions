import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

export const checkEmailExists = functions.https.onCall(async (data, context) => {
    const email = data.email;
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
        return { exists: false };
    } else {
        return { exists: true };
    }
});

export const checkUsernameExists = functions.https.onCall(async (data, context) => {
       console.log('checkUsernameExists called with data:', data);
    const username = data.username;
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();

    if (snapshot.empty) {
        return { exists: false };
    } else {
        return { exists: true };
    }
});



    export const completeRegistration = functions.https.onCall(async (data, context) => {
        console.log('completeRegistration called with data:', data);

        const uid = context.auth?.uid;
        if (!uid) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }

        const { name, username, email, dob } = data;
        const profilePic='https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTfZCGFDrC8YeednlJC3mhxPfg_s4Pg8u7-kf6dy88&s' ;
        const dobTimestamp = new admin.firestore.Timestamp(dob / 1000, 0);

        // Define userRef here using uid
        const userRef = db.collection('users').doc(uid);

        try {
            // Add to 'users' collection
            await userRef.set({
                name: name,
                username: username,
                email: email,
                dob: dobTimestamp,
                profilePic:profilePic
            });

            // Get prefixes for username search optimization (if needed)
            const get_prefixes = (username: string) => {
                let prefixes: string[] = [];
                let prefix = '';
                for (let i = 0; i < username.length; i++) {
                    prefix += username[i];
                    prefixes.push(prefix);
                }
                return prefixes;
            };

            // Add to 'usernames' collection
            await db.collection('usernames').doc(uid).set({
                userId: uid,
                username: username,
                prefixes: get_prefixes(username)
            });

            return { success: true, message: 'Registration completed successfully' };

        } catch (error) {
            console.error("Error during registration:", error);

            // Delete the user from Firebase Authentication
            try {
                await admin.auth().deleteUser(uid);
                console.log('Deleted user from Firebase Authentication due to registration failure:', uid);
            } catch (deleteError) {
                console.error('Failed to delete user from Firebase Authentication:', deleteError);
            }

            return { success: false, message: 'Registration failed' };
        }
    });

    export const getAllPosts = functions.https.onCall(async (data, context) => {
      // Check if the user is authenticated
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
      }

      const userId = context.auth.uid;
      const friendsUids: string[] = data.friendsUids || [];

      try {
        const posts: { [key: string]: any } = {};

        // Get posts made by the authenticated user
        await getUserPosts(userId, posts);

        // Get posts made by each friend if friendsUids is not empty
        if (friendsUids.length > 0) {
          for (const friendUid of friendsUids) {
            await getUserPosts(friendUid, posts);
          }
        }

        return posts;
      } catch (error) {
        console.error('Error fetching posts:', error);
        throw new functions.https.HttpsError('internal', 'Error fetching posts');
      }
    });

    async function getUserPosts(uid: string, posts: { [key: string]: any }) {
      const userPostsRef = admin.firestore().collection('posts').doc(uid).collection('user_posts');

      const userPostsSnapshot = await userPostsRef.get();

      userPostsSnapshot.forEach((doc) => {
        const postId = doc.id;

        // Check if the post with the same postId has already been included
        if (!posts[postId]) {
          const postData = doc.data();
          posts[postId] = postData;
        }
      });
    }

export const updateGender = functions.https.onCall(async (data, context) => {
  // Checking that the user is authenticated.
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
  }

  const uid = context.auth.uid;
  const newGender: string = data.gender;

  // You might want to validate the newGender value here to make sure it's valid

  try {
    await admin.firestore().collection('users').doc(uid).update({
      gender: newGender,
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating gender:', error);
    throw new functions.https.HttpsError('internal', 'Internal error occurred while updating gender');
  }
});
async function updatePostMap(uid: string, postId: string): Promise<void> {
  const usersRef = db.collection('users').doc(uid);

  // Check if 'posts' field exists in the document
  const docSnapshot = await usersRef.get();

  if (!docSnapshot.exists || !docSnapshot.data()?.posts || Object.keys(docSnapshot.data()!.posts).length === 0) {
    console.log('doesnt exist yet');
    // If 'posts' field doesn't exist or is an empty map, create a new map
    await usersRef.set({
      posts: {
        [postId]: 'active',
      },
    }, { merge: true });
  } else {
    console.log('exists');
    // If 'posts' field exists and is not empty, update the map
    await usersRef.update({
      [`posts.${postId}`]: 'active',
    });
  }
}
async function updateStatus(uid: string, postId: string,status:string): Promise<void> {
  const usersRef = db.collection('posts').doc(postId);

  // Check if 'posts' field exists in the document
  const docSnapshot = await usersRef.get();

  if (!docSnapshot.exists || !docSnapshot.data()?.status || Object.keys(docSnapshot.data()!.status).length === 0) {
    console.log('doesnt exist yet');
    // If 'posts' field doesn't exist or is an empty map, create a new map
    await usersRef.set({
      status: {
        status
      },
    }, { merge: true });
  } else {
    console.log('exists');
    // If 'posts' field exists and is not empty, update the map
    await usersRef.update({
      [`status.${uid}`]: status,
    });
  }
}
export const updatePostM = functions.https.onCall(async (data, context) => {
const{uid,postId} = data;
try{
await updatePostMap(uid,postId);
await updateStatus(uid,postId,'isNotThere');
return {success:true};
}
catch(error){
return {success:false,message:error};
}



});



export const addPost = functions.https.onCall(async (data, context) => {
  try {
   if (!context.auth) {
      throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
    }
    console.log('Adding post');
    const { postId, admin, dateTime, location, tags , status } = data;

    // Create a new post document
    const postRef = db.collection('posts').doc(postId);

    // Set data for the post document
    await postRef.set({
      postId: postId,
      admin: admin,
      dateTime: dateTime,
      tags:tags,
      location: location,

    });
    await updateStatus(admin,postId,status);
    await updatePostMap(admin,postId);

    // Calculate the time difference in milliseconds
//     const currentTime = new Date().getTime();
//     const scheduledTime = dateTime + 20 * 60 * 60 * 1000; // 20 hours in milliseconds
//
//     // Calculate the delay for setTimeout
//     const delay = scheduledTime - currentTime;
//
//     // Use setTimeout to call deletePost after the specified delay
//     setTimeout(async () => {
//       await deletePost({ params: { uid, postId } }, context);
//     }, delay);

    console.log('Post added successfully');
    return { success: true };
  } catch (error) {
    console.error('Error adding post:', error);
    return { success: false, message: error };
  }
});

// export const deletePost = functions.https.onCall(async (dataWithContext, context) => {
//    const { params } = dataWithContext; // Destructure the params object
//     const { uid, postId } = params;
//
//   // Get Firestore document reference
//   const documentRef = db.collection('posts').doc(uid).collection('user_posts').doc(postId);
//
//   // Delete the post document
//   await documentRef.delete();
//
//   //console.log(Post ${postId} of user ${uid} deleted successfully);
//   return null;
// });
export const saveProfilePicUrlToFirestore = functions.https.onCall(async (data, context) => {
    const uid = context.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const imageUrl = data.imageUrl;
    const imageName = data.imageName;
    const oldImageName = data.oldImageName; // This is the URL of the old image to delete

    const userRef = db.collection('profilepictures').doc(uid);
    try {
        // Save new imageUrl to Firestore
        await userRef.set({
            'profilePicUrl': imageUrl,
            'profilePicName':imageName,
        });

        if (oldImageName!=null) {
            // Delete the old image from Firebase Storage
            const oldImageRef = admin.storage().bucket().file(oldImageName);
            await oldImageRef.delete();
        }

        return { success: true, message: 'Profile picture updated successfully' };
    } catch (error) {
        console.error("Error saving profile picture URL:", error);
        throw new functions.https.HttpsError('internal', 'Failed to save profile picture URL.');
    }
});



export const fetchUsernames = functions.https.onCall(async (data, context) => {
    const db = admin.firestore();
    try {
        const snapshot = await db.collection('usernames').get();
        const users = snapshot.docs.map(doc => {
            return { id: doc.id, ...doc.data() };
        });
        return { users: users };
    } catch (error) {
        console.error("Error fetching usernames: ", error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch usernames.');
    }
});


exports.acceptOrRejectRequest = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to manage friend requests.');
    }
    const currentUserId = context.auth.uid;
    const senderUid = data.senderUid;
    const action = data.action; // This should be either 'accept' or 'reject'
    if (!senderUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Sender UID is required.');
    }
    const pendingRequestRef = admin.firestore().collection('users').doc(currentUserId).collection('pending_requests').doc(senderUid);

    const dataSnapshot2 = await admin.firestore().collection('users').doc(senderUid).get();
    let dataSave2 = dataSnapshot2.data();
    let userProfile2 = '';
    let name2 = '';

    if (dataSave2) {
      userProfile2 = dataSave2['profilePic'] || '';
      name2 = dataSave2['name'] || '';
    }

    const dataSnapshot1 = await admin.firestore().collection('users').doc(currentUserId).get();
    let dataSave1 = dataSnapshot1.data();
    let userProfile1 = '';
    let name1 = '';

    if (dataSave1) {
      userProfile1 = dataSave1['profilePic'] || '';
      name1 = dataSave1['name'] || '';
    }

    const friendsCollectionRef = admin.firestore().collection('friends');
    let batch = admin.firestore().batch();
    // Remove the pending request
    batch.delete(pendingRequestRef);
    if (action === 'accept') {
        const mutualFriendshipDoc1 = {
            userId1: currentUserId,
            userId2: senderUid,
            profilePic:userProfile2,
            name:name2
            // you can add other fields like timestamp or any metadata if necessary
        };
        const mutualFriendshipDoc2 = {
            userId1: senderUid,
            userId2: currentUserId,
            profilePic:userProfile1,
            name:name1
            // again, add other fields if necessary
        };
        // Add each other to the friends collection
        const newFriendshipDocRef1 = friendsCollectionRef.doc();
        batch.set(newFriendshipDocRef1, mutualFriendshipDoc1);
        const newFriendshipDocRef2 = friendsCollectionRef.doc();
        batch.set(newFriendshipDocRef2, mutualFriendshipDoc2);
    }
    return batch.commit()
        .then(() => {
        if (action === 'accept') {
            return { success: true, message: "Friend request accepted!" };
        }
        else {
            return { success: true, message: "Friend request rejected!" };
        }
    })
        .catch(error => {
        console.error(`Error processing friend request from ${senderUid} to ${currentUserId}:`, error);
        let errorMessage = 'Something went wrong. Please try again later.';
        switch (error.code) {
            case 'permission-denied':
                errorMessage = 'You do not have permission to manage friend requests.';
                break;
            case 'not-found':
                errorMessage = 'The friend request does not exist.';
                break;
            case 'deadline-exceeded':
                errorMessage = 'The operation took too long. Please try again.';
                break;
            case 'invalid-argument':
                errorMessage = 'An internal error occurred. Please report this issue.';
                break;
            case 'unavailable':
                errorMessage = 'The service is currently unavailable. Please try again later.';
                break;
        }
        return { success: false, message: errorMessage };
    });
});

export const addMessage = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  // Extract parameters from the data object
  const { chatroom_name, message } = data;

  // Validate parameters
  if (!chatroom_name || !message) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters.');
  }

  try {
    // Create a reference to the chat_rooms collection
    const chatRoomsRef = db.collection('chat_rooms');

    // Create a document in the chat_rooms collection with the specified chatroom_name
    const chatRoomDocRef = await chatRoomsRef.doc(chatroom_name);
    await chatRoomDocRef.set({}); // Set the document data

    // Explicitly cast chatRoomDocRef to DocumentReference
    const messagesRef = chatRoomDocRef.collection('messages') as admin.firestore.CollectionReference;
    message['timestamp'] = new Date(message['timestamp']);
    // Add the provided message to the messages subcollection
    await messagesRef.add(message);

    return { success: true };
  } catch (error) {
    // Explicitly cast error to any, as TypeScript cannot infer the type
    return { success: false, error: (error as any).message };
  }
});

exports.sendFriendRequest = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send friend requests.');
    }
    const senderUid = context.auth.uid;
    const recipientUid = data.recipientUid;
    if (!recipientUid || recipientUid === senderUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid recipient UID.');
    }
    const db = admin.firestore();
    // Fetch the username of the sender
    const senderDoc = await db.collection('users').doc(senderUid).get();
    if (!senderDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Sender user not found.');
    }
    const senderUsername = (_a = senderDoc.data()) === null || _a === void 0 ? void 0 : _a.username;
    if (!senderUsername) {
        throw new functions.https.HttpsError('invalid-argument', 'Sender username not found.');
    }
    // Use the UID of the sender as the document ID in the subcollection
    const pendingRequestRef = db.collection('users').doc(recipientUid).collection('pending_requests').doc(senderUid);
    return pendingRequestRef.set({
        uid: senderUid,
        username: senderUsername
    })
        .then(() => {
        // Handle success, e.g., send a notification to the recipient
        return { success: true, message: "Friend request sent!" };
    })
        .catch(error => {
        console.error(`Error sending friend request from ${senderUid} to ${recipientUid}:`, error);
        let errorMessage = 'Something went wrong. Please try again later.';
        // Handle specific error types
        switch (error.code) {
            case 'permission-denied':
                errorMessage = 'You do not have permission to send a friend request.';
                break;
            case 'not-found':
                errorMessage = 'The user you are trying to send a request to does not exist.';
                break;
            case 'deadline-exceeded':
                errorMessage = 'The operation took too long. Please try again.';
                break;
            case 'invalid-argument':
                errorMessage = 'An internal error occurred. Please report this issue.';
                break;
            case 'unavailable':
                errorMessage = 'The service is currently unavailable. Please try again later.';
                break;
        }
        return {
            success: false,
            message: errorMessage
        };
    });
});
function traverseNode(node: Node | null, targetUid: string): Node | undefined {
  if (node) {
    console.log('searching ' + targetUid + ' in ' + node.uid);
  }

  // Base case: node is null
  if (node === null) {
    return undefined;
  }

  // Check if the current node is the target node
  if (node.uid === targetUid) {
    return node;
  }

  // If the current node has children, recursively search through them
  if (node.children) {
    for (const childKey of Object.keys(node.children)) {
      console.log(childKey);
      const foundNode = traverseNode(node.children[childKey], targetUid);
      if (foundNode !== undefined) { // Fix: Use !== undefined instead of !== null
        return foundNode;
      }
    }
  }

  // If the target node is not found in the current node or its children, return undefined
  return undefined;
}

function traverseNodeAndParent(node: Node | null, targetUid: string, parent: Node | null = null): { node: Node | undefined, parent: Node | null } {
  if (node) {
    console.log('searching ' + targetUid + ' in ' + node.uid);
  }

  // Base case: node is null
  if (node === null) {
    return { node: undefined, parent: null };
  }

  // Check if the current node is the target node
  if (node.uid === targetUid) {
    return { node, parent };
  }

  // If the current node has children, recursively search through them
  if (node.children) {
    for (const childKey of Object.keys(node.children)) {
      console.log(childKey);
      const result = traverseNodeAndParent(node.children[childKey], targetUid, node);
      if (result.node !== undefined) {
        return result;
      }
    }
  }

  // If the target node is not found in the current node or its children, return undefined
  return { node: undefined, parent: null };
}

type Node = {
  uid: string;
  children: { [key: string]: Node };
};
type DatabaseReference = admin.database.Reference;

const belongsToPr = (node: Node, targetUid: string): boolean => {
  if (node.uid === targetUid) {
    return true;
  }

  if (node.children) {
    for (const childKey of Object.keys(node.children)) {
      if (belongsToPr(node.children[childKey], targetUid)) {
        return true;
      }
    }
  }

  return false;
};









const addResBasedOnScore = async (nodes: Node[], uids: string[],adminUid:string): Promise<Node | undefined> => {
  console.log('addResBasedOnScore start');
  const resultUids: Set<string> = new Set();
  let  scores: Map<string, number> = new Map();
  const direct:Array<string> = new Array();
  let adminsPr:Node|null = null;
  for (const node  of nodes) {
        if (belongsToPr(node, adminUid)) {
            adminsPr = node;
          if (findDepthOfString(node,adminUid,0)==1){
              direct.push(node.uid);
          }
          const docRef = admin.firestore().collection('prs').doc(node.uid);
          const docSnapshot = await docRef.get();

          if (docSnapshot.exists) {
            const score = docSnapshot.data()?.score || 0;
            scores.set(node.uid, score);
            resultUids.add(node.uid);
          }
          else{
          const score = 0;
          scores.set(node.uid, score);
                }
                break;
        }
    }
    console.log(uids);
    console.log(nodes);
  for (const uid of uids) {
    for (const node of nodes) {

      if (belongsToPr(node, uid)) {
      console.log('im in res and belongs to '+node.uid+' '+uid);
        if (findDepthOfString(node,uid,0)==1){
            direct.push(node.uid);
        }
        const docRef = admin.firestore().collection('prs').doc(node.uid);
        const docSnapshot = await docRef.get();

        if (docSnapshot.exists) {
          const score = docSnapshot.data()?.score || 0;
          scores.set(node.uid, score);
          resultUids.add(node.uid);
        }
        else{
        const score = 0;
        scores.set(node.uid, score);
      }
    }
  }
  console.log('direct ' +Object.keys(scores));
  let directMaxScores: Map<string,number>= new Map();
  if (scores.size === 0) {
    console.log('scores is empty');

    const randomIndex = Math.floor(Math.random() * nodes.length);
    console.log('chose pr randomly : '+nodes[randomIndex].uid);
    return nodes[randomIndex]; // No valid scores found
  }
    if (direct.length != 0) {
    console.log('there are '+direct.length+' scores');
      for (const i of direct) {
       directMaxScores.set(i, scores.get(i) || 0);
      }
    }
    else{
        if(adminsPr!=null){
        return adminsPr;
        }

    }
      if(directMaxScores.size!=0){
      console.log('directMaxScores');
        scores = directMaxScores;
      }}
  // Find the maximum score in the scores map
  const maxScore = Math.max(...scores.values());

  // Find all UIDs with the maximum score
  const maxScoreUids = Array.from(scores.entries())
    .filter(([uid, score]) => score === maxScore)
    .map(([uid]) => uid);

  if (maxScoreUids.length === 0) {
    // No UIDs with valid scores, return a random UID from the original list
    const randomIndex = Math.floor(Math.random() * nodes.length);
    return nodes[randomIndex];
  } else if (maxScoreUids.length === 1) {
    return nodes.find((pr)=>pr.uid===maxScoreUids[0]); // Return the single UID with the highest score
  } else {
    // Randomly select one UID from the UIDs with the same highest score
    const randomIndex = Math.floor(Math.random() * maxScoreUids.length);
    return nodes.find((pr)=>pr.uid===maxScoreUids[randomIndex]);
  }
};

const findDepthOfString = (node: Node, targetString: string, currentDepth: number): number | null => {
  if (node && typeof node === 'object') {
    if (node.uid === targetString) {
      // The string is found, return the current depth
      return currentDepth;
    }

    if (node.children) {
      for (const key in node.children) {
        const result = findDepthOfString(node.children[key], targetString, currentDepth + 1);
        if (result !== null) {
          return result;
        }
      }
    }
  }

  return null;
};
function getRandomNodeAtDepth(node: Node, targetDepth: number): Node | undefined {
  // Base case: reached the target depth or node has no children
  if (targetDepth === 0 || !node.children) {
    return node;
  }

  // Collect nodes at the current depth
  const nodesAtCurrentDepth: Node[] = Object.values(node.children);

  // Randomly select a node from the current depth
  const randomIndex = Math.floor(Math.random() * nodesAtCurrentDepth.length);
  const randomNode = nodesAtCurrentDepth[randomIndex];

  // Recursively traverse to the next depth
  return getRandomNodeAtDepth(randomNode, targetDepth - 1);
}
const tagChecker = (prs: Node[], tags: string[],adminUid:string, reservationWinner: Node): Node | undefined => {
  let foundFr: Node | undefined = undefined;
    let taken: string[] = [];

    console.log(reservationWinner.uid);
    if (reservationWinner.children) {
      console.log(Object.keys(reservationWinner.children));
    }

    foundFr = traverseNode(reservationWinner, adminUid);
    console.log('starting tag with '+foundFr);
    let parent: Node | undefined = undefined;

    if (foundFr === undefined) {
      let adminBelongsToOther = false;
      for(const pr of prs){
        if(traverseNode(pr,adminUid)){
            adminBelongsToOther=true;
        }
      }

      for (const t in tags) {
        if (traverseNode(reservationWinner, t) !== undefined) {
          console.log('we found it ' + traverseNode(reservationWinner, t));
          parent = traverseNode(reservationWinner, t);
          break;
        }
      }


      if (parent === undefined) {
        console.log('we didnt find it ');
        parent = getRandomNodeAtDepth(reservationWinner, 3);
        console.log('found parent' + parent);
      }

      if (parent !== undefined) {
        console.log('not undefined');
        if (parent.children && adminBelongsToOther==false) {
          console.log('kids exist : ' + Object.keys(parent.children));
          parent.children[adminUid] = { uid: adminUid, children: {} };
          foundFr = parent;
        } else if(adminBelongsToOther==false) {
          console.log('kids dont exist');
          // Using computed property name to set the key based on the adminUid variable
          parent = { uid: parent.uid, children: { [adminUid]: { uid: adminUid, children: {} } } };

          if (parent.children) {
            console.log('kids : ' + Object.keys(parent.children));
            foundFr = parent;
          }
        }
        else{
            foundFr = parent;
        }
      }
    }

    console.log('found fr :' + foundFr);
  for (const currentTag of tags) {
    let belongsTo = null;
    console.log('tag iter' + currentTag);

    for (const pr of prs) {
      if (belongsToPr(pr, currentTag)) {
        belongsTo = pr;
        break;
      }
    }

    if (belongsTo === null) {
      console.log('doesnt belong to anybody ' + currentTag);


        console.log('here i am in not undefined');
      if(foundFr!=undefined){
        if(foundFr.children){
            if(foundFr.children[adminUid]){
                if(foundFr.children[adminUid].children){

            foundFr.children[adminUid].children[currentTag] = {uid:currentTag,children:{}};
            }

            }
            else{
                foundFr.children[currentTag] ={uid:currentTag,children:{}};

            }
        }
        else{
            foundFr = {uid:foundFr.uid,children:{[currentTag]:{uid:currentTag,children:{}}}};
        }

      }

  }
  }

  if (foundFr === undefined || foundFr === null) {
    console.log('we are here');

    for (const remainingTag of tags) {
      if (!taken.includes(remainingTag)) {
        if (reservationWinner.children) {
          reservationWinner.children[remainingTag] = { uid: remainingTag, children: {} };
        } else {
          reservationWinner = { uid: reservationWinner.uid, children: { [remainingTag]: { uid: remainingTag, children: {} } } };
        }
      }
    }

    return reservationWinner;
  }





  return foundFr;
};

function findParentNodeByUid(node: Node, targetUid: string, currentPath: string = ''): string | null {
  const newPath = currentPath === '' ? node.uid : `${currentPath}/children/${node.uid}`;

  if (node.uid === targetUid) {
    return newPath;
  }

  if (node.children) {
    for (const childKey in node.children) {
      if (node.children.hasOwnProperty(childKey)) {
        const childNode = node.children[childKey];
        const result = findParentNodeByUid(childNode, targetUid,newPath);
        if (result !== null) {
          return result;
        }
      }
    }
  }

  return null;
}
const directTagChecker = (prs: Node[], tags: string[],adminUid:string, reservationWinner: Node):Map<string,Node|undefined> => {
    //let otherPr:Node|undefined = undefined;
    let result:Map<string,Node|undefined> = new Map();

    result.set('reservationWinner',reservationWinner);
    result.set('otherPr',undefined);
    result.set('parent',undefined);
    let adminBelongsTo: boolean = false;
    let adminNode:Node|undefined = undefined;
    let unexpectedError :boolean = false;
    console.log('here1');
    for(const pr of prs ){
        adminBelongsTo = belongsToPr(pr,adminUid);
        console.log(pr.uid);
        if(adminBelongsTo){

            if(pr.uid!=reservationWinner.uid){
            console.log('here2');
                result.set('otherPr',pr);
                const {node:adminNode1,parent:parentNode} = traverseNodeAndParent(pr,adminUid,null);
                adminNode = adminNode1;
                if(adminNode){
                 if (reservationWinner.children){
                                reservationWinner.children[adminUid] = adminNode;
                        }
                    else{

                        reservationWinner = {uid:reservationWinner.uid,children:{}};
                        reservationWinner.children[adminUid] = adminNode;
                    }
                }
                else{
                    console.log('unexpected error here ');
                    unexpectedError = !unexpectedError;
                }


                if(parentNode){
                    if(parentNode.children){
                        delete parentNode.children[adminUid];
                    }
                    result.set('parent',parentNode);
                }
                else{
                    result.set('parent',undefined);
                }
            }
            break;
        }

    }
    console.log('we r here now abbay')
    if (adminBelongsTo==false){
        result.set('pr',undefined);
        if(adminNode){
        console.log('we are here now bbbababaa');
        if (reservationWinner.children){
                    reservationWinner.children[adminUid] = adminNode;
                }
                else{
                    reservationWinner = {uid:reservationWinner.uid,children:{}};
                    reservationWinner.children[adminUid] = adminNode;
                }
        }
        else{
        adminNode = {uid:adminUid,children:{}};
        if(adminNode){
                console.log('we are here now bbbababaa');
                if (reservationWinner.children){
                            reservationWinner.children[adminUid] = adminNode;
                        }
                        else{
                            reservationWinner = {uid:reservationWinner.uid,children:{}};
                            reservationWinner.children[adminUid] = adminNode;
                        }
                }
        console.log('heheheheehheeheeheh');
        unexpectedError=true;
        }


    }
    for(const tag of tags){
        let belongsToPrs:boolean = false;
        for(const pr of prs){
            if(belongsToPr(pr,tag) && pr.uid!=reservationWinner.uid){
                belongsToPrs = true;
                break;
            }
        }
        if(belongsToPrs==false){
             if(reservationWinner.children[adminUid].children){
                reservationWinner.children[adminUid].children[tag] = {uid:tag,children:{}};
             }
             else{
                reservationWinner.children[adminUid].children = {[tag]:{uid:tag,children:{}}};
             }


        }
    }
    result.set('reservationWinner',reservationWinner);

    return result;
}
async function addToDatabase(path: DatabaseReference, node: Node): Promise<void> {
  console.log('adding to database');
      const databaseRef = path;
      // If the parent node already exists, add a child node with a generated key
      if (node.children) {
          console.log('children');
          console.log(node.children);
          await databaseRef.push(node.uid);
          await databaseRef.set(node);
      }
      else {
          // If the parent node does not exist, create it
          await databaseRef.set(node);
      }
}
export const direct = functions.https.onCall(async (data, context) => {
    let { adminUid, tags,clubId,direct } = data;
    const dbRef = admin.database().ref('prs/'+clubId);
    const snapshot = await dbRef.once('value');
    let allPrs: Node[] =[];
    let reservationWinner: Node | undefined = undefined;
        if(!snapshot.exists()){
           const usersWithRolePR: string[] = [];

                     try {
                       const snapshot = await admin.firestore().collection('users').where('role', '==', 'pr').get();

                       snapshot.forEach((doc) => {

                         usersWithRolePR.push(doc.id);
                       });
                     } catch (error) {
                       console.error('Error fetching users:', error);
                     }

                     for (const user of usersWithRolePR) {
                     const databaseRef = dbRef;
                           // Create a node in the Realtime Database with the UID as the key
                           const userNodeRef = databaseRef.child(user);

                           // Set the UID as a field and add children (not populated yet)
                           await userNodeRef.set({
                             uid: user    ,
                             children: {} // Populate this later with child nodes if needed
                           });
                           const obj:Node = {uid:user,children:{}};
                           allPrs.push(obj);

                         }
        }
        else{
            const prsJson = snapshot.val();
            allPrs = prsJson ? Object.values(prsJson) : [];
        }
        //const prsJson = snapshot.val();
        tags = tags ? Array.from(tags) : [];

        // Extract first-level children from the JSON file

        if (allPrs.length==0){
            const usersWithRolePR: string[] = [];

              try {
                const snapshot = await admin.firestore().collection('users').where('role', '==', 'pr').get();

                snapshot.forEach((doc) => {

                  usersWithRolePR.push(doc.id);
                });
              } catch (error) {
                console.error('Error fetching users:', error);
              }

              for (const user of usersWithRolePR) {
              const databaseRef = admin.database().ref('prs/'+clubId);
                    // Create a node in the Realtime Database with the UID as the key
                    const userNodeRef = databaseRef.child(user);

                    // Set the UID as a field and add children (not populated yet)
                    await userNodeRef.set({
                      uid: user    ,
                      children: {} // Populate this later with child nodes if needed
                    });
                    const obj:Node = {uid:user,children:{}};
                    allPrs.push(obj);

                  }



        }
        for(const pr of allPrs){
            if(traverseNode(pr,direct)){
                reservationWinner = traverseNode(pr,direct);
                break;
            }
        }
        if(reservationWinner==undefined){
        return {success:false,message : 'an error occured.Pr not found'};
        }
        else{
        console.log('not undefined the reservation winner');
            const result = directTagChecker(allPrs,tags,adminUid,reservationWinner);
            const otherPr = result.get('otherPr');
            if (otherPr){
                const parent = result.get('parent');
                if(parent){
                const key = findParentNodeByUid(otherPr, parent.uid,'');
                if(key){
                await addToDatabase(dbRef.child(key),parent);
                }

                }
                else{
                    console.log('an unexpected error occured');
                    return {success:false,message:'an unexpected error occured try again'};
                }
            }

            reservationWinner = result.get('reservationWinner');
            if(reservationWinner){
            await addToDatabase(dbRef.child(reservationWinner.uid),reservationWinner);
            }

        }

        return {success:true,message:'successfully added to tree'};


})
export const inheritedResMaker = functions.https.onCall(async (data, context) => {
  try {
    // Parameters from the client-side app
    let { adminUid, tags,clubId } = data;
      console.log('admin'+adminUid);
    // Assuming your data is stored at /path/to/prs in the Realtime Database
    const dbRef = admin.database().ref('prs/'+clubId);
    const snapshot = await dbRef.once('value');
    let allPrs: Node[] =[];
    if(!snapshot.exists()){
       const usersWithRolePR: string[] = [];

                 try {
                   const snapshot = await admin.firestore().collection('users').where('role', '==', 'pr').get();

                   snapshot.forEach((doc) => {

                     usersWithRolePR.push(doc.id);
                   });
                 } catch (error) {
                   console.error('Error fetching users:', error);
                 }

                 for (const user of usersWithRolePR) {
                 const databaseRef = dbRef;
                       // Create a node in the Realtime Database with the UID as the key
                       const userNodeRef = databaseRef.child(user);

                       // Set the UID as a field and add children (not populated yet)
                       await userNodeRef.set({
                         uid: user    ,
                         children: {} // Populate this later with child nodes if needed
                       });
                       const obj:Node = {uid:user,children:{}};
                       allPrs.push(obj);

                     }
    }
    else{
        const prsJson = snapshot.val();
        allPrs = prsJson ? Object.values(prsJson) : [];
    }
    //const prsJson = snapshot.val();
    tags = tags ? Array.from(tags) : [];

    // Extract first-level children from the JSON file

    if (allPrs.length==0){
        const usersWithRolePR: string[] = [];

          try {
            const snapshot = await admin.firestore().collection('users').where('role', '==', 'pr').get();

            snapshot.forEach((doc) => {

              usersWithRolePR.push(doc.id);
            });
          } catch (error) {
            console.error('Error fetching users:', error);
          }

          for (const user of usersWithRolePR) {
          const databaseRef = admin.database().ref('prs/'+clubId);
                // Create a node in the Realtime Database with the UID as the key
                const userNodeRef = databaseRef.child(user);

                // Set the UID as a field and add children (not populated yet)
                await userNodeRef.set({
                  uid: user    ,
                  children: {} // Populate this later with child nodes if needed
                });
                const obj:Node = {uid:user,children:{}};
                allPrs.push(obj);

              }



    }
    if(allPrs.length!=0){
    let reservationWinner: Node | undefined = undefined;
        console.log('admin is '+adminUid);
        for (const pr of allPrs) {
          if (belongsToPr(pr, adminUid)) {
            const depth = findDepthOfString(pr, adminUid, 0);
            if (depth === 1) {
              console.log('admin is direct to pr');
              reservationWinner = pr;
              break;
            } else {
            console.log('admin  is inherited by '+pr)
              break;
            }
          }
        }

        // Call the main logic function
        if (reservationWinner == undefined) {
          //tags.push(adminUid);
          const result = await addResBasedOnScore(allPrs, tags,adminUid);
          reservationWinner = result;



          // ...
          if (reservationWinner!=undefined){
          const foundFr = tagChecker(allPrs, tags,adminUid, reservationWinner );
          if(foundFr!=undefined){
            const key = findParentNodeByUid(reservationWinner, foundFr.uid,'');
            console.log('trail ');
            console.log(key);
            if ( key) {
              // Dynamically construct the child reference based on the depth
              const childRef = key ? dbRef.child(key) : dbRef;

              // Update the node with its children using a transaction
              await addToDatabase(childRef,foundFr);
            } else {
              console.error('Parent node not found.');
            }

          }
          }

        }
        else{
            if (reservationWinner!=undefined){
                      const foundFr = tagChecker(allPrs, tags,adminUid, reservationWinner );
                      if(foundFr!=undefined){
                        const key = findParentNodeByUid(reservationWinner, foundFr.uid,'');
                        console.log('trail ');
                        console.log(key);
                        if (key) {
                        const childRef = key ? dbRef.child(key) : dbRef;
                          await addToDatabase(childRef,foundFr);
                        } else {
                          console.error('Parent node not found.');
                        }

                      }
                      }
        }

        // Convert Set to Array for easier response handling
        // const resultArray = resultUids ? await Promise.all(Array.from(resultUids)) : [];

        return { status: 'success', resultArray: [] };
    }
    else{
        return {status:'failure',message:'no prs as of yet are assigned to this club'};
    }

  } catch (error) {
    console.error('Error:', error);
    return { status: 'error', message: 'Internal Server Error' };
  }
});

export const addReservation = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
    }

    console.log('Adding res');

    const { reservationId, postId, simpleBottleCount, premiumBottleCount, name, phoneNumber, admin, dateTime, prId, notes, place, placeId, placeName } = data;

    // Reference to the reservations collection
    const reservationsCollectionRef = db.collection('reservations');

    // Reference to the specific document based on placeId
    const placeDocRef = reservationsCollectionRef.doc(placeId);

    // Check if the place document exists, if not, create it
    if (!(await placeDocRef.get()).exists) {
      await placeDocRef.set({
        placeName: placeName,
      });
    }

    // Reference to the subcollection placeReservations
    const placeReservationsCollectionRef = placeDocRef.collection('placeReservations');

    // Create a new reservation document inside the placeReservations subcollection
    const reservationRef = placeReservationsCollectionRef.doc(reservationId);

    // Set data for the reservation document
    await reservationRef.set({
      reservationId: reservationId,
      postId: postId,
      simpleBottleCount: simpleBottleCount,
      premiumBottleCount: premiumBottleCount,
      name: name,
      phoneNumber: phoneNumber,
      admin: admin,
      dateTime: dateTime,
      prId: prId,
      notes: notes,
      place: place
    });

    console.log('Res added successfully');
    return { success: true };
  } catch (error) {
    console.error('Error adding res:', error);
    return { success: false, message: error };
  }
});
