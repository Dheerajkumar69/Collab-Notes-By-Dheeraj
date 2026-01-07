import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Folder, MessageCircle, Users, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  type: 'notes' | 'groups' | 'messages' | 'members' | 'custom';
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
}

const iconMap = {
  notes: FileText,
  groups: Folder,
  messages: MessageCircle,
  members: Users,
  custom: Sparkles,
};

export const EmptyState = ({ type, title, description, action, icon }: EmptyStateProps) => {
  const Icon = iconMap[type];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex flex-col items-center justify-center py-16 px-8"
    >
      {/* Animated illustration */}
      <div className="relative mb-8">
        {/* Floating circles background */}
        <motion.div
          className="absolute -inset-8 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full blur-2xl"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* Orbiting dots */}
        <motion.div
          className="absolute w-3 h-3 bg-primary rounded-full"
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            top: '-10px',
            left: '50%',
            marginLeft: '-6px',
            transformOrigin: '6px 56px',
          }}
        />
        <motion.div
          className="absolute w-2 h-2 bg-secondary rounded-full"
          animate={{
            rotate: -360,
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            top: '50%',
            right: '-15px',
            marginTop: '-4px',
            transformOrigin: '-40px 4px',
          }}
        />

        {/* Main icon container */}
        <motion.div
          className="relative z-10 h-24 w-24 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg"
          animate={{
            y: [0, -8, 0],
            rotate: [0, 2, -2, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {icon || <Icon className="h-12 w-12 text-white" />}
        </motion.div>

        {/* Sparkle effects */}
        <motion.div
          className="absolute -top-2 -right-2 text-yellow-400"
          animate={{
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
            rotate: [0, 180],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: 0.5,
          }}
        >
          <Sparkles className="h-5 w-5" />
        </motion.div>
        <motion.div
          className="absolute -bottom-1 -left-3 text-yellow-400"
          animate={{
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
            rotate: [0, -180],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: 1.5,
          }}
        >
          <Sparkles className="h-4 w-4" />
        </motion.div>
      </div>

      {/* Text content */}
      <motion.h3
        className="text-2xl font-bold mb-3 text-center bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {title}
      </motion.h3>
      
      <motion.p
        className="text-muted-foreground text-center max-w-md mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {description}
      </motion.p>

      {/* Action button */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            onClick={action.onClick}
            className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/25"
            size="lg"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {action.label}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
