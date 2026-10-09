import { shop } from "@/data/mock";
import { Reveal } from "./Reveal";
import styles from "./Contacts.module.css";

export function Contacts() {
  return (
    <section className={`section ${styles.section}`} id="contacts">
      <div className="container">
        <Reveal>
          <div className="section__head">
            <p className="section__eyebrow">Где мы</p>
            <h2 className="section__title">Контакты</h2>
            <p className="section__lead">
              Приходите в гости или запишитесь заранее — так быстрее и удобнее.
            </p>
          </div>
        </Reveal>

        <div className={styles.grid}>
          <Reveal>
            <dl className={styles.info}>
              <div>
                <dt>Адрес</dt>
                <dd>{shop.address}</dd>
              </div>
              <div>
                <dt>Телефон</dt>
                <dd>
                  <a href={shop.phoneHref}>{shop.phone}</a>
                </dd>
              </div>
              <div>
                <dt>Часы работы</dt>
                <dd>{shop.hours}</dd>
              </div>
            </dl>
          </Reveal>

          <Reveal delayMs={100}>
            <div className={styles.mapWrap}>
              <iframe
                title="Карта барбершопа Атлант"
                src={shop.mapEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
