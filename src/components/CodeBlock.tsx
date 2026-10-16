import { CopyButton } from './CopyButton';

type CodeBlockProps = {
  code: string;
  className?: string;
};

/** Read-only code panel with a copy button on a slim top bar. */
export function CodeBlock({ code, className }: CodeBlockProps) {
  return (
    <div
      className={`overflow-hidden rounded-[12px] border border-white/[0.12] bg-[#0d0b0a]/85 backdrop-blur-md ${className ?? ''}`}
    >
      <div className='flex items-center justify-end px-4 pt-3.5'>
        <CopyButton text={code} />
      </div>
      <pre className='overflow-x-auto px-5 pt-2 pb-5 font-mono text-[13px] leading-[1.75] text-[#ddd6cf]'>
        <code>{code}</code>
      </pre>
    </div>
  );
}
