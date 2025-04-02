import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const storage = getStorage();

export const uploadImage = async (file) => {
  const fileRef = ref(storage, `festival_images/${file.name}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
};


