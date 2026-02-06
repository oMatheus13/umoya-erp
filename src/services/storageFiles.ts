import { supabase } from './supabaseClient'

const DEFAULT_BUCKET = 'umoya-files'
const AVATAR_FOLDER = 'avatars'

const getBucket = () => import.meta.env.VITE_SUPABASE_BUCKET || DEFAULT_BUCKET

const resolveAvatarExtension = (mimeType?: string) => {
  if (mimeType === 'image/webp') {
    return 'webp'
  }
  if (mimeType === 'image/png') {
    return 'png'
  }
  return 'jpg'
}

export const uploadAvatar = async (userId: string, file: Blob) => {
  if (!supabase) {
    return { path: null, error: 'Supabase nao configurado.' }
  }
  const bucket = getBucket()
  const extension = resolveAvatarExtension(file.type)
  const path = `${AVATAR_FOLDER}/${userId}/avatar.${extension}`
  try {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    })
    if (error) {
      return { path: null, error: error.message }
    }
    return { path, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao enviar imagem.'
    return { path: null, error: message }
  }
}

export const createSignedAvatarUrl = async (path: string, expiresIn = 60 * 60 * 24) => {
  if (!supabase) {
    return { url: null, error: 'Supabase nao configurado.' }
  }
  const bucket = getBucket()
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)
    if (error) {
      return { url: null, error: error.message }
    }
    return { url: data?.signedUrl ?? null, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao gerar link.'
    return { url: null, error: message }
  }
}
