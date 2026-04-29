export default function LoadingSpinner({
  className = "py-12",
}: {
  className?: string;
}) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
    </div>
  );
}
