import React from "react"
import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"
import type {
  DocumentBlock,
  DocumentSection,
  PlanningDocumentModel,
} from "@/lib/document-model"

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10.5,
    lineHeight: 1.5,
    color: "#172133",
    paddingTop: 72,
    paddingBottom: 65,
    paddingHorizontal: 68,
  },
  cover: {
    fontFamily: "Helvetica",
    color: "#172133",
    paddingHorizontal: 72,
    paddingVertical: 72,
    justifyContent: "space-between",
  },
  coverMark: {
    fontSize: 12,
    color: "#167c70",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  coverTitle: {
    marginTop: 110,
    fontSize: 26,
    lineHeight: 1.25,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  coverSubtitle: {
    marginTop: 14,
    fontSize: 12,
    color: "#526071",
    textAlign: "center",
  },
  coverTopic: {
    marginTop: 28,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#b9c3cc",
    fontSize: 13,
    textAlign: "center",
  },
  coverMeta: {
    marginTop: 80,
    alignSelf: "center",
    width: "75%",
  },
  coverMetaRow: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: "#d5dce2",
    paddingVertical: 7,
  },
  coverMetaLabel: {
    width: "34%",
    fontFamily: "Helvetica-Bold",
  },
  header: {
    position: "absolute",
    top: 28,
    left: 68,
    right: 68,
    borderBottomWidth: 0.7,
    borderBottomColor: "#aeb8c2",
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#526071",
    fontSize: 8.5,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 68,
    right: 68,
    borderTopWidth: 0.7,
    borderTopColor: "#aeb8c2",
    paddingTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#647180",
    fontSize: 8,
  },
  documentTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    marginBottom: 6,
  },
  documentSubtitle: {
    color: "#526071",
    fontSize: 9.5,
    marginBottom: 20,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    color: "#146f65",
    fontSize: 13,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.7,
    borderBottomColor: "#b8d8d3",
  },
  paragraph: {
    marginBottom: 7,
    textAlign: "justify",
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  listRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingRight: 8,
  },
  listMarker: {
    width: 17,
    color: "#167c70",
  },
  listText: {
    flex: 1,
  },
  table: {
    borderWidth: 0.7,
    borderColor: "#9ba8b4",
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#c5ced6",
  },
  tableHeader: {
    backgroundColor: "#e8f3f1",
  },
  tableCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 0.5,
    borderRightColor: "#c5ced6",
    fontSize: 8.2,
    lineHeight: 1.35,
  },
  tableHeaderText: {
    fontFamily: "Helvetica-Bold",
    color: "#164f49",
  },
  documentImage: {
    alignSelf: "center",
    maxHeight: 330,
    objectFit: "contain",
    marginVertical: 8,
  },
  imageCaption: {
    textAlign: "center",
    color: "#647180",
    fontSize: 8,
    marginBottom: 8,
  },
  question: {
    marginBottom: 15,
  },
  questionText: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
  },
  alternative: {
    marginLeft: 18,
    marginBottom: 3,
  },
  answerLine: {
    height: 17,
    borderBottomWidth: 0.5,
    borderBottomColor: "#aeb8c2",
  },
  institution: {
    fontFamily: "Helvetica-Bold",
  },
})

function Header({ school, teacher, model }: { school?: string; teacher?: string; model: PlanningDocumentModel }) {
  const left = [school, teacher].filter(Boolean).join(" · ")
  return (
    <View style={styles.header} fixed>
      <Text>{left || "+ Educação"}</Text>
      <Text>{model.identificationFields.find((field) => field.label === "Área/Disciplina")?.value}</Text>
    </View>
  )
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>+ Educação · BNCC Planner</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const chunks: string[][][] = []
  for (let index = 0; index < rows.length; index += 12) chunks.push(rows.slice(index, index + 12))

  return (
    <>
      {chunks.map((chunk, chunkIndex) => (
        <View key={chunkIndex} style={styles.table} wrap>
          <View style={[styles.tableRow, styles.tableHeader]} wrap={false}>
            {headers.map((header) => (
              <View key={header} style={styles.tableCell}>
                <Text style={styles.tableHeaderText}>{header}</Text>
              </View>
            ))}
          </View>
          {chunk.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.tableRow} wrap={false}>
              {headers.map((_, cellIndex) => (
                <View key={cellIndex} style={styles.tableCell}>
                  <Text>{row[cellIndex] || ""}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </>
  )
}

function Block({ block }: { block: DocumentBlock }) {
  if (block.type === "paragraph") {
    return <Text style={[styles.paragraph, block.bold ? styles.bold : {}]}>{block.text}</Text>
  }
  if (block.type === "bullets" || block.type === "numbered") {
    return (
      <View>
        {block.items.filter(Boolean).map((item, index) => (
          <View key={`${item}-${index}`} style={styles.listRow} wrap={false}>
            <Text style={styles.listMarker}>{block.type === "numbered" ? `${index + 1}.` : "•"}</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>
    )
  }
  if (block.type === "table") return <TableBlock headers={block.headers} rows={block.rows} />
  if (block.type === "image") {
    return (
      <View wrap={false}>
        <PdfImage
          src={block.image.src}
          style={[styles.documentImage, { width: `${block.image.widthPercent}%` }]}
        />
      </View>
    )
  }
  return (
    <View>
      {block.questions.map((question) => {
        const linkedImages = block.images.filter(
          (image) => image.placementKey === `question:${question.numero}`,
        )
        return (
        <View key={question.numero} style={styles.question} wrap={false}>
          <Text style={styles.questionText}>{question.numero}. {question.enunciado}</Text>
          {linkedImages.map((image) => (
            <View key={image.src} wrap={false}>
              <PdfImage
                src={image.src}
                style={[styles.documentImage, { width: `${image.widthPercent}%` }]}
              />
            </View>
          ))}
          {question.alternativas.length > 0 ? (
            question.alternativas.map((alternative, index) => (
              <Text key={alternative} style={styles.alternative}>
                {String.fromCharCode(97 + index)}) {alternative}
              </Text>
            ))
          ) : (
            <>
              <View style={styles.answerLine} />
              <View style={styles.answerLine} />
            </>
          )}
        </View>
        )
      })}
    </View>
  )
}

function SectionView({ section, index }: { section: DocumentSection; index: number }) {
  return (
    <View
      style={styles.section}
      break={section.pageBreakBefore}
      minPresenceAhead={80}
    >
      <Text style={styles.sectionTitle}>{index + 1}. {section.title}</Text>
      {section.blocks.map((block, blockIndex) => (
        <Block key={blockIndex} block={block} />
      ))}
    </View>
  )
}

export function PlanningPdfDocument({
  model,
  school,
  teacher,
  orientation,
}: {
  model: PlanningDocumentModel
  school?: string
  teacher?: string
  orientation: "portrait" | "landscape"
}) {
  return (
    <Document
      title={model.title}
      subject={model.topic}
      author={teacher || "+ Educação"}
      creator="+ Educação · BNCC Planner"
      producer="+ Educação · BNCC Planner"
    >
      {model.cover && (
        <Page size="A4" orientation={orientation} style={styles.cover}>
          <Text style={styles.coverMark}>+ Educação · BNCC Planner</Text>
          <View>
            <Text style={styles.coverTitle}>{model.title}</Text>
            <Text style={styles.coverSubtitle}>{model.subtitle}</Text>
            <Text style={styles.coverTopic}>Assunto: {model.topic}</Text>
            <View style={styles.coverMeta}>
              {school && (
                <View style={styles.coverMetaRow}><Text style={styles.coverMetaLabel}>Escola</Text><Text>{school}</Text></View>
              )}
              {teacher && (
                <View style={styles.coverMetaRow}><Text style={styles.coverMetaLabel}>Professor(a)</Text><Text>{teacher}</Text></View>
              )}
              {model.identificationFields.map((field) => (
                <View key={field.label} style={styles.coverMetaRow}>
                  <Text style={styles.coverMetaLabel}>{field.label}</Text>
                  <Text>{field.value}</Text>
                </View>
              ))}
            </View>
          </View>
          <Text style={{ textAlign: "center", fontSize: 9, color: "#647180" }}>
            Documento pedagógico gerado com apoio de Inteligência Artificial. Revise antes da aplicação.
          </Text>
          <Footer />
        </Page>
      )}

      <Page size="A4" orientation={orientation} style={styles.page} wrap>
        <Header school={school} teacher={teacher} model={model} />
        <Footer />
        <Text style={styles.documentTitle}>{model.title}</Text>
        <Text style={styles.documentSubtitle}>
          {model.subtitle} · Assunto: {model.topic}
        </Text>
        {model.sections.map((section, index) => (
          <SectionView key={`${section.title}-${index}`} section={section} index={index} />
        ))}
      </Page>
    </Document>
  )
}
