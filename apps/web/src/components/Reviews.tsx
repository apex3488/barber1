import { reviews } from "@/data/mock";
import { Reveal } from "./Reveal";
import styles from "./Reviews.module.css";

function Stars({ rating }: { rating: number }) {
  return (
    <span className={styles.stars} aria-label={`Оценка ${rating} из 5`}>
      {"★".repeat(rating)}
      <span aria-hidden="true">{"☆".repeat(5 - rating)}</span>
    </span>
  );
}

export function Reviews() {
  return (
    <section className="section" id="reviews">
      <div className="container">
        <Reveal>
          <div className="section__head">
            <p className="section__eyebrow">Гости говорят</p>
            <h2 className="section__title">Отзывы</h2>
            <p className="section__lead">
              Коротко о том, как проходит визит — от записи до результата.
            </p>
          </div>
        </Reveal>

        <div className={styles.list}>
          {reviews.map((review, index) => (
            <Reveal key={review.id} delayMs={index * 70}>
              <blockquote className={styles.quote}>
                <Stars rating={review.rating} />
                <p>«{review.comment}»</p>
                <footer>— {review.author}</footer>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
