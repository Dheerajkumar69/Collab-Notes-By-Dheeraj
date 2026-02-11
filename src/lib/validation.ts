import { z } from 'zod';

// Auth schemas
export const signInSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255, 'Email too long'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signUpSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255, 'Email too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  fullName: z.string().trim().min(1, 'Full name is required').max(100, 'Name too long'),
});

// Group schemas
export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(50, 'Group name must be less than 50 characters'),
  description: z.string().max(200, 'Description must be less than 200 characters').optional(),
  color: z.enum(['blue', 'green', 'purple', 'orange', 'pink', 'indigo']).default('blue'),
});

// Note schemas
export const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  content: z.string().optional(),
  groupId: z.string().uuid('Invalid group ID'),
  labels: z.array(z.string()).optional(),
  color: z.enum(['white', 'blue', 'green', 'purple', 'orange', 'pink', 'indigo']).default('white'),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters').optional(),
  content: z.string().optional(),
  labels: z.array(z.string()).optional(),
  color: z.enum(['white', 'blue', 'green', 'purple', 'orange', 'pink', 'indigo']).optional(),
  isPinned: z.boolean().optional(),
});

// Profile schemas
export const updateProfileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(50, 'Full name must be less than 50 characters'),
  email: z.string().email('Invalid email address'),
});

// Edit request schemas
export const createEditRequestSchema = z.object({
  noteId: z.string().uuid('Invalid note ID'),
  message: z.string().min(1, 'Message is required').max(500, 'Message must be less than 500 characters'),
});

// Types
export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type CreateGroupFormData = z.infer<typeof createGroupSchema>;
export type CreateNoteFormData = z.infer<typeof createNoteSchema>;
export type UpdateNoteFormData = z.infer<typeof updateNoteSchema>;
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
export type CreateEditRequestFormData = z.infer<typeof createEditRequestSchema>;