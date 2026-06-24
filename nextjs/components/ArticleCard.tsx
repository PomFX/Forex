import type { Article } from '@/types'

export default function ArticleCard({ article }: { article: Article }) {
  return (
    <div className="card-glow">
      {article.image && (
        <div className="-mx-5 -mt-5 mb-4 overflow-hidden rounded-t-xl">
          <img src={article.image} alt={article.title} className="w-full h-40 object-cover" />
        </div>
      )}
      <h3 className="font-semibold text-white mb-2 line-clamp-2">{article.title}</h3>
      <p className="text-sm text-gray-400 mb-3 line-clamp-3">{article.content}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {new Date(article.created_at).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'long', day: 'numeric',
          })}
        </span>
        <a
          href={`/articles/${article.id}`}
          className="text-xs text-gold-400 hover:text-gold-300 transition-colors font-medium"
        >
          อ่านต่อ →
        </a>
      </div>
    </div>
  )
}
