import { motion } from 'framer-motion';
import { Link } from 'wouter';

export function HomeFooter() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.5 }}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center z-10"
    >
      <Link href="/about">
        <span className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground cursor-pointer transition-colors">
          Concordia Wave — Human Decision Security
        </span>
      </Link>
    </motion.div>
  );
}
