const fetch = require('node-fetch');
const { createRemoteFileNode } = require('gatsby-source-filesystem');

const books = require('./src/data/books.json');
const authors = require('./src/data/authors.json');
const { graphql } = require('gatsby');
const { default: slugify } = require('slugify');

exports.sourceNodes = ({ actions, createNodeId, createContentDigest }) => {
  const { createNode, createTypes } = actions;

  createTypes(`
    type Author implements Node {
      books: [Book!]! @link(from: "slug" by: "author.slug")
    }

    type Book implements Node {
      author: Author! @link(from: "author" by: "slug")
    }
  `);

  authors.forEach((author) => {
    createNode({
      ...author,
      id: createNodeId(`author-${author.slug}`),
      parent: null,
      children: [],
      internal: {
        type: 'Author',
        content: JSON.stringify(author),
        contentDigest: createContentDigest(author),
      },
    });
  });

  books.forEach((book) => {
    createNode({
      ...book,
      id: createNodeId(`book-${book.isbn}`),
      parent: null,
      children: [],
      internal: {
        type: 'Book',
        content: JSON.stringify(book),
        contentDigest: createContentDigest(book),
      },
    });
  });
};

exports.createPages = async ({ actions }) => {
  const { createPage } = actions;

  createPage({
    path: '/custom',
    component: require.resolve('./src/templates/custom.js'),
    context: {
      title: 'A custom page',
      meta: {
        description: 'A custome page w/ context',
      },
    },
  });

  const result = await graphql(`
    query GetBooks {
      allBook {
        nodes {
          id
          series
          name
        }
      }
    }
  `);

  const books = result.data.allBook.nodes;

  books.forEach((book) => {
    const bookSlug = slugify(book.name, { lower: true });

    if (book.series === null) {
      createPage({
        path: `/book/${bookSlug}`,
        component: require.resolve(`./src/templates/book.js`),
        context: {
          id: book.id,
        },
      });
    } else {
      const seriesSlug = slugify(book.series, { lower: true });

      createPage({
        path: `/book/${seriesSlug}/${bookSlug}`,
        component: require.resolve(`./src/templates/book.js`),
        context: {
          id: book.id,
        },
      });
    }
  });
};

exports.createResolvers = ({
  createResolvers,
  actions,
  cache,
  createNodeId,
  store,
  reporter,
}) => {
  const { createNode } = actions;
  const resolvers = {
    Book: {
      buyLink: {
        type: 'String',
        resolve: (source) =>
          `https://www.powells.com/searchresults?keyword=${source.isbn}`,
      },
      cover: {
        type: 'File',
        resolve: async (source) => {
          const res = await fetch(
            `https://openlibrary.org/isbn/${source.isbn}.json`,
          );

          if (!res.ok) {
            reporter.warn(
              `Error loading details about ${source.name} ??? got ${response.status} ${response.statusText}`,
            );
            return null;
          }

          const { covers } = await res.json();

          if (covers.length) {
            return createRemoteFileNode({
              url: `https://covers.openlibrary.org/b/id/${covers[0]}-L.jpg`,
              store,
              cache,
              createNode,
              createNodeId,
              reporter,
            });
          } else {
            return null;
          }
        },
      },
    },
  };

  createResolvers(resolvers);
};
