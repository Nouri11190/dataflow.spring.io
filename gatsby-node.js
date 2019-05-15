const path = require('path')
const get = require('lodash.get')
const startsWith = require('lodash.startswith')
const { createFilePath } = require('gatsby-source-filesystem')
const checkstyles = require('./plugins/spring-checkstyles')

const versions = require('./content/versions.json')

const currentVersion = versions.current

const isDev = process.env.NODE_ENV === 'development'

/**
 * Create Pages
 */
exports.createPages = ({ graphql, actions }) => {
  const { createPage } = actions
  const queryPromises = []

  let excludeKeys = ['current', 'next']
  if (isDev) {
    excludeKeys = ['current']
  }

  queryPromises.push(
    new Promise((resolve, reject) => {
      for (const [key, version] of Object.entries(versions)) {
        if (excludeKeys.indexOf(key) === -1) {
          const VersionTemplate = path.resolve(`./src/templates/version.js`)
          createPage({
            path: `/docs/${version}/`,
            component: VersionTemplate,
            context: {
              version: version,
              versionPath: `/docs/${version}/`,
            },
          })
        }
      }
      return resolve()
    })
  )

  queryPromises.push(
    new Promise((resolve, reject) => {
      graphql(`
        {
          pages: allMarkdownRemark(
            filter: {
              fields: { hash: { eq: "documentation" } }
              frontmatter: { exclude: { eq: null } }
            }
            limit: 1000
          ) {
            edges {
              node {
                id
                fileAbsolutePath
                headings {
                  value
                  depth
                }
                frontmatter {
                  title
                  description
                }
                fields {
                  path
                  version
                }
              }
            }
          }
        }
      `).then(result => {
        if (result.errors) {
          return reject(result.errors)
        }
        result.data.pages.edges.forEach(({ node }) => {
          const DocumentationTemplate = path.resolve(
            `./src/templates/documentation.js`
          )
          checkstyles(node)
          if (!(!isDev && node.fields.version === 'next')) {
            createPage({
              path: node.fields.path,
              component: DocumentationTemplate,
              context: {
                slug: node.fields.path,
                version: node.fields.version,
              },
            })
          }
        })
        return resolve()
      })
    })
  )

  return Promise.all(queryPromises)
}

/**
 * Create Node
 */
exports.onCreateNode = async ({ node, getNode, actions }) => {
  const { createNodeField } = actions
  if (get(node, 'internal.type') === `MarkdownRemark`) {
    const frontmatterPath = get(node, 'frontmatter.path')
    const slug = createFilePath({ node, getNode, basePath: `pages` })
    const relativePath = path.relative(__dirname, node.fileAbsolutePath)

    const pathArr = relativePath.split('/')
    const version = pathArr[1]
    const filename = pathArr[pathArr.length - 1]

    if (startsWith(relativePath, 'data/')) {
      if (!startsWith(filename, '_')) {
        // Page
        const category = frontmatterPath
          .split('/')
          .slice(0, 1)
          .join('')
        const isRoot = frontmatterPath.split('/').length === 2
        let url = `/docs/${version}/${frontmatterPath}`

        if (version === currentVersion) {
          url = `/docs/${frontmatterPath}`
        }

        createNodeField({
          node,
          name: `hash`,
          value: `documentation`,
        })
        createNodeField({
          node,
          name: `category`,
          value: category,
        })
        createNodeField({
          node,
          name: `version`,
          value: version,
        })
        createNodeField({
          node,
          name: `root`,
          value: isRoot,
        })
        createNodeField({
          node,
          name: `slug`,
          value: slug,
        })
        createNodeField({
          node,
          name: `path`,
          value: path.join(url, '/'),
        })
      } else {
        // Template
        createNodeField({
          node,
          name: `hash`,
          value: `documentation-template`,
        })
        createNodeField({
          node,
          name: `version`,
          value: version,
        })
      }
    }
  }
}
