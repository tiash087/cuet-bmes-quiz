import sqlite3
from pathlib import Path

NEW_QUESTIONS = [
    # Chemistry
    {
        'question_text': 'নিচের কোন যৌগে S এর জারণ মান +4?',
        'option_a': 'H₂SO₄',
        'option_b': 'H₂SO₃',
        'option_c': 'CuSO₄',
        'option_d': 'Na₂S₂O₃',
        'correct_option': 'B',
        'category': 'Chemistry',
        'difficulty': 'Easy',
        'explanation': 'H₂SO₃ যৌগে: 2(+1) + S + 3(-2) = 0 => S = +4।'
    },
    {
        'question_text': 'কোন বিক্রিয়াটিতে ইলেকট্রন স্থানান্তর ঘটে (রেডক্স বিক্রিয়া)?',
        'option_a': 'Ca + 2HCl = CaCl₂ + H₂',
        'option_b': 'KOH + HCl = KCl + H₂O',
        'option_c': 'KCl + AgNO₃ = AgCl + KNO₃',
        'option_d': 'MgCl₂ + 7H₂O = MgCl₂.7H₂O',
        'correct_option': 'A',
        'category': 'Chemistry',
        'difficulty': 'Easy',
        'explanation': 'Ca 0 থেকে +2 এবং H +1 থেকে 0 এ পরিবর্তিত হয় (ইলেকট্রন স্থানান্তর ঘটে)।'
    },
    {
        'question_text': 'কোন বিক্রিয়াটিতে চাপের প্রভাব বিদ্যমান?',
        'option_a': 'NH₄CNO -Δ→ H₂N-CO-NH₂',
        'option_b': 'N₂(g) + O₂(g) ⇌ 2NO(g)',
        'option_c': '3NO₂(g) + H₂O(g) ⇌ 2HNO₃(g) + NO(g)',
        'option_d': 'H₂(g) + Cl₂(g) ⇌ 2HCl(g)',
        'correct_option': 'C',
        'category': 'Chemistry',
        'difficulty': 'Medium',
        'explanation': 'লা-শাতেলীয়ার নীতি অনুযায়ী বিক্রিয়ক ও উৎপাদের গ্যাসীয় মোল সংখ্যা অসমান (Δn ≠ 0) হলে চাপের প্রভাব থাকে।'
    },
    {
        'question_text': 'SnCl₂ + 2FeCl₃ → 2FeCl₂ + SnCl₄ উদ্দীপকের বিক্রিয়ায়:\ni. Fe³⁺ বিজারিত হয়েছে\nii. Cl⁻ দর্শক আয়ন\niii. Sn²⁺ জারিত হয়েছে\nনিচের কোনটি সঠিক?',
        'option_a': 'i ও ii',
        'option_b': 'i ও iii',
        'option_c': 'ii ও iii',
        'option_d': 'i, ii ও iii',
        'correct_option': 'D',
        'category': 'Chemistry',
        'difficulty': 'Medium',
        'explanation': 'Fe³⁺ ইলেকট্রন গ্রহণ করে বিজারিত, Sn²⁺ ইলেকট্রন ত্যাগ করে জারিত এবং Cl⁻ এর জারণ মান অপরিবর্তিত।'
    },
    {
        'question_text': '2FeCl₂ + Cl₂ → 2FeCl₃ বিক্রিয়াটি:\ni. সমানুকরণ বিক্রিয়া\nii. জারণ-বিজারণ\niii. সংযোজন বিক্রিয়া\nনিচের কোনটি সঠিক?',
        'option_a': 'i ও ii',
        'option_b': 'i ও iii',
        'option_c': 'ii ও iii',
        'option_d': 'i, ii ও iii',
        'correct_option': 'C',
        'category': 'Chemistry',
        'difficulty': 'Medium',
        'explanation': 'এটি একই সাথে জারণ-বিজারণ এবং দুটি পদার্থ মিলে একটি তৈরি হওয়া সংযোজন বিক্রিয়া।'
    },
    {
        'question_text': 'চুনাপাথরের উপর লঘু সালফিউরিক এসিড যোগ করলে নিচের কোন যৌগটি উৎপন্ন হবে?',
        'option_a': 'CO₂',
        'option_b': 'H₂',
        'option_c': 'O₂',
        'option_d': 'SO₂',
        'correct_option': 'A',
        'category': 'Chemistry',
        'difficulty': 'Easy',
        'explanation': 'CaCO₃ + H₂SO₄ → CaSO₄ + H₂O + CO₂↑।'
    },
    {
        'question_text': 'নিচের কোনটির উপস্থিতির জন্য অ্যামোনিয়া গ্যাসের জলীয় দ্রবণ ক্ষারীয়?',
        'option_a': 'NH₄⁺ আয়ন',
        'option_b': 'OH⁻ আয়ন',
        'option_c': 'NH₃',
        'option_d': 'H₂O',
        'correct_option': 'B',
        'category': 'Chemistry',
        'difficulty': 'Easy',
        'explanation': 'NH₃ + H₂O ⇌ NH₄⁺ + OH⁻ দ্রবনে মুক্ত হাইড্রোক্সাইড (OH⁻) আয়ন উপস্থিতির কারণে।'
    },
    {
        'question_text': 'K₂Cr₂O₇ যৌগে Cr এর জারণ সংখ্যা কত?',
        'option_a': '+3',
        'option_b': '+6',
        'option_c': '+4',
        'option_d': '+7',
        'correct_option': 'B',
        'category': 'Chemistry',
        'difficulty': 'Easy',
        'explanation': '2(+1) + 2(Cr) + 7(-2) = 0 => 2Cr = +12 => Cr = +6।'
    },
    {
        'question_text': 'ফিটকিরির (Potash Alum) সঠিক রাসায়নিক সংকেত কোনটি?',
        'option_a': 'K₂SO₄.Al₂(SO₄)₃.24H₂O',
        'option_b': 'FeSO₄.(NH₄)₂SO₄.6H₂O',
        'option_c': 'CuSO₄.5H₂O',
        'option_d': 'Na₂CO₃.10H₂O',
        'correct_option': 'A',
        'category': 'Chemistry',
        'difficulty': 'Medium',
        'explanation': 'পটাশ অ্যালাম বা ফিটকিরির সংকেত K₂SO₄.Al₂(SO₄)₃.24H₂O।'
    },
    {
        'question_text': 'নিচের কোনটি ঊর্ধ্বপাতিত (Sublimable) পদার্থ?',
        'option_a': 'কর্পূর (Camphor)',
        'option_b': 'সোডিয়াম ক্লোরাইড (NaCl)',
        'option_c': 'কপার সালফেট (CuSO₄)',
        'option_d': 'গ্লুকোজ (C₆H₁₂O₆)',
        'correct_option': 'A',
        'category': 'Chemistry',
        'difficulty': 'Easy',
        'explanation': 'কর্পূর তাপ দিলে সরাসরি কঠিন থেকে বাষ্পে পরিণত হয়।'
    },
    {
        'question_text': '2FeCl₃ + H₂S → 2FeCl₂ + 2HCl + S বিক্রিয়াটিতে বিজারক (Reducing Agent) কোনটি?',
        'option_a': 'FeCl₃',
        'option_b': 'H₂S',
        'option_c': 'HCl',
        'option_d': 'FeCl₂',
        'correct_option': 'B',
        'category': 'Chemistry',
        'difficulty': 'Medium',
        'explanation': 'H₂S নিজে জারিত হয়ে S (০) উৎপন্ন করে এবং FeCl₃ কে বিজারিত করে, তাই H₂S বিজারক।'
    },
    {
        'question_text': 'PCl₅(g) + তাপ ⇌ PCl₃(g) + Cl₂(g) বিক্রিয়ায় Cl₂ এর উৎপাদন বাড়াতে কী ব্যবস্থা গ্রহণ করতে হবে?',
        'option_a': 'তাপমাত্রা বৃদ্ধি ও চাপ হ্রাস',
        'option_b': 'তাপমাত্রা হ্রাস ও চাপ বৃদ্ধি',
        'option_c': 'শুধুমাত্র চাপ বৃদ্ধি',
        'option_d': 'তাপমাত্রা ও চাপ উভয়ই বৃদ্ধি',
        'correct_option': 'A',
        'category': 'Chemistry',
        'difficulty': 'Hard',
        'explanation': 'তাপোৎপাদী নয় (তাপহারী) বলে তাপমাত্রা বাড়ালে এবং উৎপাদে মোল সংখ্যা বেশি হওয়ায় চাপ কমালে সাম্যাবস্থা ডানে যাবে।'
    },
    {
        'question_text': 'একটি যৌগে 2.04% হাইড্রোজেন, 32.65% সালফার এবং 65.31% অক্সিজেন বিদ্যমান থাকলে যৌগটির আণবিক সংকেত কোনটি?',
        'option_a': 'H₂SO₃',
        'option_b': 'H₂SO₄',
        'option_c': 'H₂S₂O₃',
        'option_d': 'H₂S₂O₇',
        'correct_option': 'B',
        'category': 'Chemistry',
        'difficulty': 'Medium',
        'explanation': 'H:S:O মোল অনুপাত = 2.04 : 1.02 : 4.08 = 2 : 1 : 4 => H₂SO₄।'
    },
    {
        'question_text': 'কপারের (Cu) সাথে কোন এসিডের বিক্রিয়া ঘটে?',
        'option_a': 'লঘু HCl',
        'option_b': 'গাঢ় H₂SO₄ বা গাঢ় HNO₃',
        'option_c': 'লঘু H₂SO₄',
        'option_d': 'লঘু H₃PO₄',
        'correct_option': 'B',
        'category': 'Chemistry',
        'difficulty': 'Medium',
        'explanation': 'কপার সক্রিয়তা সিরিজে হাইড্রোজেনের নিচে থাকায় এটি শুধুমাত্র তীব্র জারক এসিড (যেমন গাঢ় H₂SO₄ / HNO₃) এর সাথে বিক্রিয়া করে।'
    },

    # Higher Math
    {
        'question_text': '2.31̇ কে মূলদীয় ভগ্নাংশে প্রকাশ করলে কত হবে?',
        'option_a': '104/45 (বা 208/90)',
        'option_b': '231/99',
        'option_c': '208/99',
        'option_d': '231/90',
        'correct_option': 'A',
        'category': 'Higher Math',
        'difficulty': 'Medium',
        'explanation': '(231 - 23) / 90 = 208 / 90 = 104 / 45।'
    },
    {
        'question_text': '1 + (3x + 2)⁻¹ + (3x + 2)⁻² + ... অনন্ত গুণোত্তর ধারাটির অসীমতক সমষ্টি থাকার শর্ত কোনটি?',
        'option_a': 'x > -1/3 অথবা x < -1',
        'option_b': '-1 < x < -1/3',
        'option_c': 'x > 1/3 অথবা x < -1',
        'option_d': 'x > 0',
        'correct_option': 'A',
        'category': 'Higher Math',
        'difficulty': 'Hard',
        'explanation': 'সাধারণ অনুপাত |r| < 1 => |1/(3x+2)| < 1 => |3x+2| > 1 => x > -1/3 অথবা x < -1।'
    },
    {
        'question_text': 'ঢাকা থেকে সিঙ্গাপুর দূরুত্ব 2900 কি.মি.। সর্বোচ্চ গতিবেগ 900 কি.মি./ঘণ্টা এবং প্রতিকূল বাতাসের বেগ 100 কি.মি./ঘণ্টা হলে প্রয়োজনীয় সময় t এর অসমতা কোনটি?',
        'option_a': 't ≥ 29/8 ঘণ্টা (বা t ≥ 3.625 ঘণ্টা)',
        'option_b': 't ≤ 29/8 ঘণ্টা',
        'option_c': 't ≥ 2900/900 ঘণ্টা',
        'option_d': 't ≤ 29/9 ঘণ্টা',
        'correct_option': 'A',
        'category': 'Higher Math',
        'difficulty': 'Hard',
        'explanation': 'কার্যকর সর্বোচ্চ বেগ = 900 - 100 = 800 কি.মি./ঘণ্টা। সর্বনিম্ন সময় = 2900/800 = 29/8 ঘণ্টা। সুতরাং t ≥ 29/8 ঘণ্টা।'
    },
    {
        'question_text': 'a, b ও c তিনটি বাস্তব সংখ্যা। a > b এবং c ≠ 0 হলে—\n(i) ac > bc যখন c > 0\n(ii) ac < bc যখন c < 0\n(iii) a/c > b/c যখন c > 0\nনিচের কোনটি সঠিক?',
        'option_a': 'i ও ii',
        'option_b': 'i ও iii',
        'option_c': 'ii ও iii',
        'option_d': 'i, ii ও iii',
        'correct_option': 'D',
        'category': 'Higher Math',
        'difficulty': 'Easy',
        'explanation': 'অসমতার মৌলিক নিয়ম অনুসারে তিনটি উক্তিই শতভাগ সত্য।'
    },
    {
        'question_text': 'রিতা, মিতা ও বীথির বয়স যথাক্রমে x, 2x ও 3x বছর এবং সমষ্টি অনুর্ধ্ব 60 বছর হলে—\n(i) সমস্যাটির গাণিতিক প্রকাশ x + 2x + 3x ≤ 60\n(ii) রিতার বয়স ≤ 10 বছর\n(iii) মিতার বয়স ≥ 20 বছর\nনিচের কোনটি সঠিক?',
        'option_a': 'i ও ii',
        'option_b': 'i ও iii',
        'option_c': 'ii ও iii',
        'option_d': 'i, ii ও iii',
        'correct_option': 'A',
        'category': 'Higher Math',
        'difficulty': 'Easy',
        'explanation': '6x ≤ 60 => x ≤ 10 (রিতার বয়স ≤ 10)। মিতার বয়স 2x ≤ 20 (≥ 20 ভুল)।'
    },
    {
        'question_text': 'কোনো একটি অনুক্রমের n-তম পদ u_n = 1/n এবং u_n < 10⁻⁴ হলে n এর মান কোনটি?',
        'option_a': 'n > 10⁴ (বা n > 10000)',
        'option_b': 'n < 10⁴',
        'option_c': 'n < 10³',
        'option_d': 'n = 10⁴',
        'correct_option': 'A',
        'category': 'Higher Math',
        'difficulty': 'Medium',
        'explanation': '1/n < 1/10000 => n > 10000 বা n > 10⁴।'
    },
    {
        'question_text': 'কোনো একটি অনুক্রমের n-তম পদ u_n = 1 - (-1)ⁿ হলে—\n(i) 10-তম পদ 0\n(ii) 15-তম পদ 2\n(iii) প্রথম 12 পদের সমষ্টি 12\nনিচের কোনটি সঠিক?',
        'option_a': 'i ও ii',
        'option_b': 'i ও iii',
        'option_c': 'ii ও iii',
        'option_d': 'i, ii ও iii',
        'correct_option': 'D',
        'category': 'Higher Math',
        'difficulty': 'Medium',
        'explanation': 'জোড় পদের মান 0 এবং বিজোড় পদের মান 2। প্রথম 12 পদে 6টি বিজোড় পদের সমষ্টি 6 × 2 = 12।'
    }
]

db_path = Path(__file__).parent / "quiz.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

added = 0
for q in NEW_QUESTIONS:
    cursor.execute("SELECT id FROM questions WHERE question_text = ?", (q["question_text"],))
    if not cursor.fetchone():
        cursor.execute("""
        INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, category, difficulty, explanation, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (q["question_text"], q["option_a"], q["option_b"], q["option_c"], q["option_d"], q["correct_option"], q["category"], q["difficulty"], q["explanation"]))
        added += 1

conn.commit()

cursor.execute("SELECT COUNT(*) FROM questions WHERE is_active = 1")
total = cursor.fetchone()[0]
conn.close()

print(f"Successfully added {added} new questions! Total questions in DB: {total}")
