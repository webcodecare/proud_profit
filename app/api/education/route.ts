import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') // beginner, intermediate, advanced
    const topic = searchParams.get('topic') // trading, analysis, security, portfolio
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    let query = supabase
      .from('educational_content')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (category) {
      query = query.eq('category', category)
    }
    
    if (topic) {
      query = query.eq('topic', topic)
    }
    
    const { data: content, error } = await query
    
    if (error) {
      console.error('Failed to fetch educational content:', error)
      
      // Return sample educational content if database fails
      const sampleContent = generateSampleEducationalContent(category, topic)
      return NextResponse.json({
        content: sampleContent,
        pagination: {
          limit,
          offset,
          hasMore: false
        },
        is_sample: true
      })
    }
    
    return NextResponse.json({
      content: content || [],
      pagination: {
        limit,
        offset,
        hasMore: (content?.length || 0) === limit
      },
      is_sample: false
    })
    
  } catch (error) {
    console.error('Educational content API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateSampleEducationalContent(category?: string | null, topic?: string | null) {
  const allContent = [
    {
      id: 1,
      title: 'Introduction to Bitcoin Trading',
      description: 'Learn the basics of Bitcoin trading, including market analysis and risk management.',
      category: 'beginner',
      topic: 'trading',
      content_type: 'article',
      reading_time: 10,
      difficulty: 'easy',
      tags: ['bitcoin', 'trading', 'basics'],
      author: 'Trading Expert',
      created_at: '2024-01-15T10:00:00Z'
    },
    {
      id: 2,
      title: 'Technical Analysis Fundamentals',
      description: 'Understanding charts, indicators, and patterns for better trading decisions.',
      category: 'intermediate',
      topic: 'analysis',
      content_type: 'video',
      reading_time: 25,
      difficulty: 'medium',
      tags: ['technical-analysis', 'charts', 'indicators'],
      author: 'Market Analyst',
      created_at: '2024-01-20T14:30:00Z'
    },
    {
      id: 3,
      title: 'Portfolio Diversification Strategies',
      description: 'Learn how to diversify your cryptocurrency portfolio to minimize risk.',
      category: 'intermediate',
      topic: 'portfolio',
      content_type: 'article',
      reading_time: 15,
      difficulty: 'medium',
      tags: ['portfolio', 'diversification', 'risk-management'],
      author: 'Portfolio Manager',
      created_at: '2024-01-25T09:15:00Z'
    },
    {
      id: 4,
      title: 'Advanced Options Trading',
      description: 'Deep dive into options trading strategies for experienced traders.',
      category: 'advanced',
      topic: 'trading',
      content_type: 'course',
      reading_time: 120,
      difficulty: 'hard',
      tags: ['options', 'advanced-trading', 'derivatives'],
      author: 'Options Specialist',
      created_at: '2024-02-01T16:45:00Z'
    },
    {
      id: 5,
      title: 'Cryptocurrency Security Best Practices',
      description: 'Essential security measures to protect your digital assets.',
      category: 'beginner',
      topic: 'security',
      content_type: 'guide',
      reading_time: 12,
      difficulty: 'easy',
      tags: ['security', 'wallets', 'best-practices'],
      author: 'Security Expert',
      created_at: '2024-02-05T11:20:00Z'
    },
    {
      id: 6,
      title: 'Market Psychology and Emotional Trading',
      description: 'Understanding market psychology and controlling emotions while trading.',
      category: 'intermediate',
      topic: 'trading',
      content_type: 'article',
      reading_time: 18,
      difficulty: 'medium',
      tags: ['psychology', 'emotions', 'trading-mindset'],
      author: 'Trading Psychologist',
      created_at: '2024-02-10T13:00:00Z'
    }
  ]
  
  let filteredContent = allContent
  
  if (category) {
    filteredContent = filteredContent.filter(item => item.category === category)
  }
  
  if (topic) {
    filteredContent = filteredContent.filter(item => item.topic === topic)
  }
  
  return filteredContent
}